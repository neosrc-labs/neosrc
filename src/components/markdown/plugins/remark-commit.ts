import type { Content, Parent, Root } from "mdast";

export function remarkCommitPlugin(owner?: string, repo?: string) {
    return function attacher() {
        return function transformer(tree: Root) {
            function walk(node: Content | Root, parent: Parent | null) {
                if ("children" in node) {
                    for (const child of [...node.children].reverse()) {
                        walk(child, node);
                    }
                }

                if (
                    node.type === "text" &&
                    parent &&
                    parent.type !== "link" &&
                    parent.type !== "inlineCode" &&
                    parent.type !== "code"
                ) {
                    const value = node.value;
                    const commitRegex = /\b([0-9a-f]{7,40})\b/gi;
                    const parts: Part[] = [];
                    let cursor = 0;
                    let match: RegExpExecArray | null;

                    match = commitRegex.exec(value);
                    while (match !== null) {
                        if (match.index > cursor) {
                            parts.push({
                                type: "text",
                                value: value.slice(cursor, match.index),
                            });
                        }

                        if (match[1] && owner && repo) {
                            const sha = match[1].toLowerCase();

                            parts.push({
                                type: "link",
                                url: `https://github.com/${owner}/${repo}/commit/${sha}`,
                                children: [{ type: "text", value: match[1] }],
                            });
                        }

                        cursor = match.index + match[0].length;

                        match = commitRegex.exec(value);
                    }

                    if (cursor < value.length) {
                        parts.push({
                            type: "text",
                            value: value.slice(cursor),
                        });
                    }

                    if (parts.length > 0) {
                        const childIndex = parent.children.indexOf(node);
                        if (childIndex !== -1) {
                            parent.children.splice(childIndex, 1, ...parts);
                        }
                    }
                }
            }

            walk(tree, null);
        };
    };
}

type Part =
    | { type: "text"; value: string }
    | { type: "link"; url: string; children: Part[] };
