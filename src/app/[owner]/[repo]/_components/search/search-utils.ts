interface Qualifier {
    key: string;
    value: string;
}

export interface QueryToken {
    // Raw text of the token, kept verbatim so operators, quoting, and the
    // order the user typed survive a parse/format round trip.
    text: string;
    // Set when the token is a key:value qualifier.
    qualifier?: Qualifier;
}

export interface ParsedQuery {
    tokens: QueryToken[];
}

// Unquoted values stop at whitespace or a parenthesis so `(is:closed)` keeps
// its closing bracket instead of swallowing it into the value.
const QUALIFIER_RE = /(\w+):("[^"]*"|[^\s()]+)/g;

export function parseQuery(query: string): ParsedQuery {
    const tokens: QueryToken[] = [];

    let lastIndex = 0;

    QUALIFIER_RE.lastIndex = 0;

    for (;;) {
        const match = QUALIFIER_RE.exec(query);
        if (!match) break;
        const textBefore = query.slice(lastIndex, match.index).trim();
        if (textBefore) tokens.push({ text: textBefore });
        tokens.push({
            text: match[0],
            qualifier: {
                key: match[1] ?? "",
                value: (match[2] ?? "").replace(/^"|"$/g, ""),
            },
        });
        lastIndex = match.index + match[0].length;
    }

    const remaining = query.slice(lastIndex).trim();
    if (remaining) tokens.push({ text: remaining });

    return { tokens };
}

export function formatQuery(parsed: ParsedQuery): string {
    return parsed.tokens
        .map((token) => token.text)
        .join(" ")
        .trim();
}

function serializeQualifier(key: string, value: string): string {
    return `${key}:${value.includes(" ") ? `"${value}"` : value}`;
}

function qualifiers(parsed: ParsedQuery): Qualifier[] {
    const result: Qualifier[] = [];
    for (const token of parsed.tokens) {
        if (token.qualifier) result.push(token.qualifier);
    }
    return result;
}

export function hasQualifier(
    query: string,
    key: string,
    value: string,
): boolean {
    return qualifiers(parseQuery(query)).some(
        (q) => q.key === key && q.value === value,
    );
}

export function getQualifierValue(
    query: string,
    key: string,
): string | undefined {
    return qualifiers(parseQuery(query)).find((q) => q.key === key)?.value;
}

export function removeQualifier(
    query: string,
    key: string,
    value: string,
): string {
    const parsed = parseQuery(query);
    parsed.tokens = parsed.tokens.filter(
        (token) =>
            !(token.qualifier?.key === key && token.qualifier.value === value),
    );
    return formatQuery(parsed);
}

export function removeQualifiersByKey(
    query: string,
    keys: readonly string[],
): string {
    const parsed = parseQuery(query);
    parsed.tokens = parsed.tokens.filter(
        (token) => !token.qualifier || !keys.includes(token.qualifier.key),
    );
    return formatQuery(parsed);
}

export interface QualifierPrefixMatch {
    start: number;
    end: number;
    value: string;
}

/**
 * Finds the qualifier that extends the word under the cursor, so the search box
 * can show the rest of the name as typeahead. Only the word typed at the end of
 * the query counts; a word sitting in a value (`label:bu`) or inside a quoted
 * value is not a qualifier being typed. Ambiguous prefixes (`s` for sort and
 * status) and complete names return null, so Tab never guesses.
 */
export function matchQualifierPrefix(
    text: string,
    cursorPos: number,
    qualifiers: string[],
): QualifierPrefixMatch | null {
    if (cursorPos !== text.length) return null;

    let start = cursorPos;
    while (start > 0 && /[\w-]/.test(text[start - 1] ?? "")) start--;
    if (start === cursorPos) return null;

    const preceding = text[start - 1];
    if (preceding === ":" || preceding === '"') return null;

    const word = text.slice(start, cursorPos);
    const matches = qualifiers.filter(
        (q) =>
            q.length > word.length &&
            q.toLowerCase().startsWith(word.toLowerCase()),
    );
    const [match] = matches;
    if (!match || matches.length > 1) return null;

    return { start, end: cursorPos, value: match };
}

const HIGHLIGHT_RE = /(\w+:"[^"]*"|\w+:\S+)/g;

export interface QuerySegment {
    text: string;
    isQualifier: boolean;
}

export function splitQuery(query: string): QuerySegment[] {
    const segments: QuerySegment[] = [];
    let lastIndex = 0;
    HIGHLIGHT_RE.lastIndex = 0;

    for (;;) {
        const match = HIGHLIGHT_RE.exec(query);
        if (!match) break;
        if (match.index > lastIndex) {
            segments.push({
                text: query.slice(lastIndex, match.index),
                isQualifier: false,
            });
        }
        segments.push({
            text: match[0],
            isQualifier: true,
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < query.length) {
        segments.push({
            text: query.slice(lastIndex),
            isQualifier: false,
        });
    }

    return segments;
}

export function replaceQualifier(
    query: string,
    key: string,
    value: string,
): string {
    const parsed = parseQuery(query);
    parsed.tokens = parsed.tokens.filter(
        (token) => token.qualifier?.key !== key,
    );
    parsed.tokens.push({
        text: serializeQualifier(key, value),
        qualifier: { key, value },
    });
    return formatQuery(parsed);
}

export function addQualifier(
    query: string,
    key: string,
    value: string,
): string {
    const parsed = parseQuery(query);
    const existing = parsed.tokens.some(
        (token) =>
            token.qualifier?.key === key && token.qualifier.value === value,
    );
    if (existing) return query;
    parsed.tokens.push({
        text: serializeQualifier(key, value),
        qualifier: { key, value },
    });
    return formatQuery(parsed);
}

// Removes the qualifier when the exact key:value pair is present, otherwise
// adds it. mode controls what happens when the key exists with a different
// value: "replace" swaps it (single-value keys like author), "add" keeps it
// (multi-value keys like label).
export function toggleQualifier(
    query: string,
    key: string,
    value: string,
    mode: "add" | "replace" = "replace",
): string {
    return hasQualifier(query, key, value)
        ? removeQualifier(query, key, value)
        : mode === "add"
          ? addQualifier(query, key, value)
          : replaceQualifier(query, key, value);
}
