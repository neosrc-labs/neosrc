import type { Content, Parent, Root } from "mdast";

export function remarkIssuePlugin(owner?: string, repo?: string) {
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
                    const combinedRegex =
                        /(\b[\w.-]+\/[\w.-]+#\d+\b)|(?<!\w)(#\d+)\b/g;
                    const parts: Part[] = [];
                    let cursor = 0;
                    let match: RegExpExecArray | null;

                    match = combinedRegex.exec(value);
                    while (match !== null) {
                        if (match.index > cursor) {
                            parts.push({
                                type: "text",
                                value: value.slice(cursor, match.index),
                            });
                        }

                        if (match[1]) {
                            const str = match[1];
                            const hashIdx = str.lastIndexOf("#");
                            const slashIdx = str.lastIndexOf("/", hashIdx);
                            const matchedOwner = str.slice(0, slashIdx);
                            const matchedRepo = str.slice(
                                slashIdx + 1,
                                hashIdx,
                            );
                            const matchedNum = str.slice(hashIdx + 1);

                            parts.push({
                                type: "link",
                                url: `https://github.com/${matchedOwner}/${matchedRepo}/issues/${matchedNum}`,
                                children: [{ type: "text", value: str }],
                            });
                        } else if (match[2]) {
                            if (owner && repo) {
                                const hashRef = match[2];

                                parts.push({
                                    type: "link",
                                    url: `https://github.com/${owner}/${repo}/issues/${hashRef.slice(1)}`,
                                    children: [
                                        { type: "text", value: hashRef },
                                    ],
                                });
                            } else {
                                parts.push({
                                    type: "text",
                                    value: match[2],
                                });
                            }
                        }

                        cursor = match.index + match[0].length;

                        match = combinedRegex.exec(value);
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
