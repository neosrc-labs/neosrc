import type { Content, Parent, Root } from "mdast";

/** A text node or a link whose children are text/links. */
export type MdastPart =
    | { type: "text"; value: string }
    | { type: "link"; url: string; children: MdastPart[] };

/**
 * Walk the mdast tree and transform every text node whose parent type is not
 * in `excludedParentTypes`. `transform` returns either a replacement string
 * or a list of parts to splice in place of the node.
 */
export function transformTextNodes(
    tree: Root,
    excludedParentTypes: readonly string[],
    transform: (value: string) => string | readonly MdastPart[],
): void {
    function walk(node: Content | Root, parent: Parent | null): void {
        if ("children" in node) {
            for (const child of [...node.children].reverse()) {
                walk(child, node);
            }
        }

        if (
            node.type === "text" &&
            parent &&
            !excludedParentTypes.includes(parent.type)
        ) {
            const replacement = transform(node.value);
            if (typeof replacement === "string") {
                if (replacement === node.value) return;
                const childIndex = parent.children.indexOf(node);
                if (childIndex !== -1) {
                    parent.children.splice(childIndex, 1, {
                        type: "text",
                        value: replacement,
                    });
                }
                return;
            }
            if (replacement.length === 0) return;
            const childIndex = parent.children.indexOf(node);
            if (childIndex !== -1) {
                parent.children.splice(childIndex, 1, ...replacement);
            }
        }
    }

    walk(tree, null);
}

/**
 * Split `value` on `regex`, emitting the plain text before each match plus the
 * parts produced by `onMatch`, then any trailing text.
 */
export function matchToParts(
    value: string,
    regex: RegExp,
    onMatch: (match: RegExpExecArray) => readonly MdastPart[],
): MdastPart[] {
    const parts: MdastPart[] = [];
    let cursor = 0;
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(value);
    while (match !== null) {
        if (match.index > cursor) {
            parts.push({
                type: "text",
                value: value.slice(cursor, match.index),
            });
        }
        parts.push(...onMatch(match));
        cursor = match.index + match[0].length;
        match = regex.exec(value);
    }
    if (cursor < value.length) {
        parts.push({ type: "text", value: value.slice(cursor) });
    }
    return parts;
}
