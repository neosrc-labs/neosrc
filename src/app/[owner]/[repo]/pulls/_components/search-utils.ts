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
