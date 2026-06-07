export interface Qualifier {
    key: string;
    value: string;
}

export interface ParsedQuery {
    qualifiers: Qualifier[];
    freeText: string;
}

const QUALIFIER_RE = /(\w+):("[^"]*"|\S+)/g;

export function parseQuery(query: string): ParsedQuery {
    const qualifiers: Qualifier[] = [];
    const freeTextParts: string[] = [];

    let lastIndex = 0;

    QUALIFIER_RE.lastIndex = 0;

    for (;;) {
        const match = QUALIFIER_RE.exec(query);
        if (!match) break;
        const textBefore = query.slice(lastIndex, match.index).trim();
        if (textBefore) freeTextParts.push(textBefore);
        qualifiers.push({
            key: match[1] ?? "",
            value: (match[2] ?? "").replace(/^"|"$/g, ""),
        });
        lastIndex = match.index + match[0].length;
    }

    const remaining = query.slice(lastIndex).trim();
    if (remaining) freeTextParts.push(remaining);

    return { qualifiers, freeText: freeTextParts.join(" ") };
}

export function formatQuery(parsed: ParsedQuery): string {
    const parts = parsed.qualifiers.map(
        (q) => `${q.key}:${q.value.includes(" ") ? `"${q.value}"` : q.value}`,
    );
    if (parsed.freeText) parts.push(parsed.freeText);
    return parts.join(" ");
}

export function hasQualifier(
    query: string,
    key: string,
    value: string,
): boolean {
    const parsed = parseQuery(query);
    return parsed.qualifiers.some((q) => q.key === key && q.value === value);
}

export function removeQualifier(
    query: string,
    key: string,
    value: string,
): string {
    const parsed = parseQuery(query);
    parsed.qualifiers = parsed.qualifiers.filter(
        (q) => !(q.key === key && q.value === value),
    );
    return formatQuery(parsed);
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
    parsed.qualifiers = parsed.qualifiers.filter((q) => q.key !== key);
    parsed.qualifiers.push({ key, value });
    return formatQuery(parsed);
}

export function addQualifier(
    query: string,
    key: string,
    value: string,
): string {
    const parsed = parseQuery(query);
    const existing = parsed.qualifiers.find(
        (q) => q.key === key && q.value === value,
    );
    if (existing) return query;
    parsed.qualifiers.push({ key, value });
    return formatQuery(parsed);
}
