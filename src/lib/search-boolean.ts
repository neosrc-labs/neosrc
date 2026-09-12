// Translation of the AND/OR/NOT query syntax into what each forge's search
// backend actually accepts. GitHub's search service takes a space as AND and a
// leading `-` as NOT, and has no OR at all, so a query with OR is split into its
// disjunctive branches and each branch is run as its own search (see
// github-search.ts). Labels are the exception: GitHub accepts `label:a,b` for
// the union, so label-only ORs stay a single query. Forgejo takes `+term` as
// required and `-term` as excluded, and has no OR, so only that form is built
// there.

export type SearchProvider = "gh" | "cb";

interface Token {
    text: string;
    kind: "qualifier" | "operator" | "paren" | "word";
    key?: string;
    value?: string;
    negated?: boolean;
    operator?: "AND" | "OR" | "NOT";
}

export interface BooleanTranslation {
    // Backend-ready query text.
    query: string;
    // Note about syntax the provider cannot express, or null when the whole
    // query was translated.
    unsupported: string | null;
}

export interface GithubQueryPlan {
    // Disjunctive branches; the union of these is the result set. More than one
    // means the caller must run a search per branch and merge. A single branch
    // is one backend query.
    branches: string[];
    // Note about syntax that could not be expressed, or null.
    unsupported: string | null;
    // True when every branch asks for the presence and the absence of the same
    // metadata, so the query cannot match anything. GitHub does not resolve
    // this itself: it drops the value qualifier next to `no:` and returns the
    // `no:` set instead of nothing, so the caller returns an empty page.
    unsatisfiable: boolean;
}

const CB_PARENTHESES_HINT =
    "Parentheses are not supported by Codeberg search and were ignored.";
const UNPARSED_HINT =
    "The AND/OR groups could not be parsed, so the terms were searched together.";
const OR_KEYWORD_HINT =
    "Codeberg search has no OR and the OR terms were treated as AND.";
const NOT_TERM_HINT = "NOT must be followed by a search term.";
const NOT_FILTER_HINT =
    "Codeberg search cannot exclude a filter, so NOT was ignored.";
const TOO_MANY_BRANCHES_HINT =
    "This query has too many OR branches to search; simplify it into fewer groups.";

// Bounds the fan-out of a query: each branch costs a request per page, and the
// union counts need one intersection term per non-empty subset.
const MAX_BRANCHES = 4;

function tokenize(query: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < query.length) {
        const char = query[i];
        if (char === undefined) break;
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (char === "(" || char === ")") {
            tokens.push({ text: char, kind: "paren" });
            i++;
            continue;
        }

        let raw = "";
        let quoted = false;
        while (i < query.length) {
            const next = query[i];
            if (next === undefined) break;
            if (next === '"') {
                quoted = !quoted;
                raw += next;
                i++;
                continue;
            }
            if (!quoted && (/\s/.test(next) || next === "(" || next === ")")) {
                break;
            }
            raw += next;
            i++;
        }
        if (raw) tokens.push(classify(raw));
    }
    return tokens;
}

function classify(raw: string): Token {
    // AND and OR fold case: the search backend treats the upper case forms as
    // literal terms, and their lower case forms as prose. NOT stays upper case
    // only because the lower case word is common in prose ("not working") and
    // folding it would silently negate a term.
    const upper = raw.toUpperCase();
    if (upper === "AND" || upper === "OR") {
        return { text: raw, kind: "operator", operator: upper };
    }
    if (raw === "NOT") {
        return { text: raw, kind: "operator", operator: "NOT" };
    }

    const negated = raw.startsWith("-") && raw.length > 1;
    const body = negated ? raw.slice(1) : raw;
    const qualifier = /^(\w+):("[^"]*"|.*)$/.exec(body);
    if (qualifier) {
        return {
            text: raw,
            kind: "qualifier",
            key: qualifier[1],
            value: (qualifier[2] ?? "").replace(/^"|"$/g, ""),
            negated,
        };
    }
    return { text: raw, kind: "word", negated };
}

function renderLabelValue(value: string): string {
    return value.includes(" ") ? `"${value}"` : value;
}

function join(tokens: Token[]): string {
    return tokens
        .map((token) => token.text)
        .join(" ")
        .trim();
}

type Node =
    | { kind: "atom"; token: Token }
    | { kind: "not"; child: Node }
    | { kind: "and"; children: Node[] }
    | { kind: "or"; children: Node[] };

interface Literal {
    token: Token;
    negated: boolean;
}

type Conjunction = Literal[];

class QuerySyntaxError extends Error {}

function parseExpression(tokens: Token[], state: { index: number }): Node {
    const terms = [parseAnd(tokens, state)];
    for (;;) {
        const token = tokens[state.index];
        if (!(token?.kind === "operator" && token.operator === "OR")) break;
        state.index++;
        terms.push(parseAnd(tokens, state));
    }
    return terms.length === 1
        ? (terms[0] as Node)
        : { kind: "or", children: terms };
}

function parseAnd(tokens: Token[], state: { index: number }): Node {
    const factors: Node[] = [];
    for (;;) {
        const token = tokens[state.index];
        if (!token) break;
        if (token.kind === "paren" && token.text === ")") break;
        if (token.kind === "operator" && token.operator === "OR") break;
        if (token.kind === "operator" && token.operator === "AND") {
            state.index++;
            continue;
        }
        factors.push(parseFactor(tokens, state));
    }
    if (factors.length === 0) throw new QuerySyntaxError("empty term");
    return factors.length === 1
        ? (factors[0] as Node)
        : { kind: "and", children: factors };
}

function parseFactor(tokens: Token[], state: { index: number }): Node {
    const token = tokens[state.index];
    if (!token) throw new QuerySyntaxError("dangling term");

    if (token.kind === "operator" && token.operator === "NOT") {
        state.index++;
        return { kind: "not", child: parseFactor(tokens, state) };
    }

    if (token.kind === "paren") {
        if (token.text !== "(") throw new QuerySyntaxError("unbalanced parens");
        state.index++;
        const inner = parseExpression(tokens, state);
        const closing = tokens[state.index];
        if (!(closing?.kind === "paren" && closing.text === ")")) {
            throw new QuerySyntaxError("unbalanced parens");
        }
        state.index++;
        return inner;
    }

    if (token.kind === "operator")
        throw new QuerySyntaxError("dangling operator");
    state.index++;
    return { kind: "atom", token };
}

function cross(parts: Conjunction[][]): Conjunction[] {
    let result: Conjunction[] = [[]];
    for (const part of parts) {
        const next: Conjunction[] = [];
        for (const left of result) {
            for (const right of part) next.push([...left, ...right]);
        }
        result = next;
    }
    return result;
}

// Distributive normal form: negated groups are pushed onto the atoms (via De
// Morgan), then ORs are distributed over ANDs.
function toDnf(node: Node, negated: boolean): Conjunction[] {
    switch (node.kind) {
        case "atom":
            return [
                [
                    {
                        token: node.token,
                        negated: node.token.negated !== negated,
                    },
                ],
            ];
        case "not":
            return toDnf(node.child, !negated);
        case "and": {
            const parts = node.children.map((child) => toDnf(child, negated));
            return negated ? parts.flat() : cross(parts);
        }
        case "or": {
            const parts = node.children.map((child) => toDnf(child, negated));
            return negated ? cross(parts) : parts.flat();
        }
    }
}

function renderLiteral(literal: Literal): string {
    const { token } = literal;
    const text =
        token.key === "has" && token.value === "assignee"
            ? "assignee:*"
            : token.text;
    const base = text.startsWith("-") ? text.slice(1) : text;
    return literal.negated ? `-${base}` : base;
}

// Last resort for queries the parser cannot handle: keep every term, drop the
// boolean words and parentheses, which the backend would otherwise search for
// literally.
function renderAndOnly(tokens: Token[]): string {
    return join(
        tokens.filter(
            (token) =>
                token.kind !== "paren" &&
                !(token.kind === "operator" && token.operator === "OR"),
        ),
    );
}

function renderConjunction(literals: Conjunction): string {
    return literals.map(renderLiteral).join(" ").trim();
}

function isPositiveLabel(literal: Literal): boolean {
    return (
        !literal.negated &&
        literal.token.kind === "qualifier" &&
        literal.token.key === "label"
    );
}

// Fields GitHub exposes both a value form and a `no:` absence form for.
const PRESENCE_FIELDS = new Set(["assignee", "label", "milestone", "project"]);

// A conjunction that demands a field be both absent (`no:assignee`) and present
// (`assignee:x`, `has:assignee`) can never match. GitHub drops the presence
// qualifier and returns the `no:` set, so it has to be caught here.
function isContradictory(conjunction: Conjunction): boolean {
    const absent = new Set<string>();
    const present = new Set<string>();
    for (const literal of conjunction) {
        if (literal.negated || literal.token.kind !== "qualifier") continue;
        const { key, value } = literal.token;
        if (key === "no" && value && PRESENCE_FIELDS.has(value)) {
            absent.add(value);
        } else if (key === "has" && value && PRESENCE_FIELDS.has(value)) {
            present.add(value);
        } else if (key && PRESENCE_FIELDS.has(key)) {
            present.add(key);
        }
    }
    for (const field of absent) {
        if (present.has(field)) return true;
    }
    return false;
}

// Public entry point for the GitHub path.
export function planGithubQuery(query: string): GithubQueryPlan {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
        return { branches: [], unsupported: null, unsatisfiable: false };
    }

    let dnf: Conjunction[];
    try {
        const state = { index: 0 };
        const expression = parseExpression(tokens, state);
        // Leftover tokens mean stray parentheses or a dangling operator.
        if (state.index !== tokens.length) {
            throw new QuerySyntaxError("unconsumed tokens");
        }
        dnf = toDnf(expression, false);
    } catch {
        // Unparseable (dangling NOT, unbalanced parens). Search the terms as
        // plain text rather than failing the whole request.
        return {
            branches: [renderAndOnly(tokens)],
            unsupported: UNPARSED_HINT,
            unsatisfiable: false,
        };
    }

    if (dnf.length === 0) {
        return { branches: [], unsupported: null, unsatisfiable: false };
    }

    // A contradictory branch cannot match, so it drops out of the union. When
    // every branch is contradictory the whole query matches nothing.
    const satisfiable = dnf.filter(
        (conjunction) => !isContradictory(conjunction),
    );
    if (satisfiable.length === 0) {
        return { branches: [], unsupported: null, unsatisfiable: true };
    }
    dnf = satisfiable;

    if (dnf.length > MAX_BRANCHES) {
        return {
            branches: [renderAndOnly(tokens)],
            unsupported: TOO_MANY_BRANCHES_HINT,
            unsatisfiable: false,
        };
    }

    // GitHub accepts a comma separated list of labels as a union, so an OR over
    // single labels stays one exact query.
    if (
        dnf.length > 1 &&
        dnf.every((conjunction) => conjunction.length === 1) &&
        dnf.every((conjunction) => isPositiveLabel(conjunction[0] as Literal))
    ) {
        const values = dnf.map((conjunction) => {
            const literal = conjunction[0] as Literal;
            return renderLabelValue(literal.token.value ?? "");
        });
        return {
            branches: [`label:${values.join(",")}`],
            unsupported: null,
            unsatisfiable: false,
        };
    }

    return {
        branches: dnf.map(renderConjunction),
        unsupported: null,
        unsatisfiable: false,
    };
}

// Forgejo: qualifiers are applied by the provider, so only the free-text terms
// travel in `q`. Every term becomes required (`+`) to match the AND semantics
// GitHub users expect, and NOT becomes `-`.
export function translateForgejoKeywords(query: string): BooleanTranslation {
    const tokens = tokenize(query);
    const out: string[] = [];
    let unsupported: string | null = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === undefined) break;

        if (token.kind === "qualifier") continue;

        if (token.kind === "paren") {
            unsupported ??= CB_PARENTHESES_HINT;
            continue;
        }

        if (token.operator === "AND") continue;

        if (token.operator === "NOT") {
            const next = tokens[i + 1];
            if (next?.kind === "word") {
                out.push(next.negated ? next.text : `-${next.text}`);
                i++;
            } else if (next?.kind === "qualifier") {
                unsupported ??= NOT_FILTER_HINT;
                i++;
            } else {
                unsupported ??= NOT_TERM_HINT;
            }
            continue;
        }

        if (token.operator === "OR") {
            unsupported ??= OR_KEYWORD_HINT;
            continue;
        }

        out.push(token.negated ? token.text : `+${token.text}`);
    }

    return { query: out.join(" "), unsupported };
}

export function booleanSearchHint(
    provider: SearchProvider,
    query: string,
): string | null {
    return provider === "cb"
        ? translateForgejoKeywords(query).unsupported
        : planGithubQuery(query).unsupported;
}
