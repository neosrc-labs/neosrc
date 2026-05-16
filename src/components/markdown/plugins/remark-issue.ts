export function remarkIssuePlugin(owner?: string, repo?: string) {
    return function attacher() {
        return function transformer(tree: any) {
            function walk(node: any, parent: any) {
                if (!node) return;
                if (node.children) {
                    for (let i = node.children.length - 1; i >= 0; i--) {
                        walk(node.children[i], node);
                    }
                }

                if (
                    node.type === "text" &&
                    parent &&
                    parent.type !== "link" &&
                    parent.type !== "inlineCode" &&
                    parent.type !== "code"
                ) {
                    const value = node.value as string;
                    const combinedRegex =
                        /(\b[\w.-]+\/[\w.-]+#\d+\b)|(?<!\w)(#\d+)\b/g;
                    const parts: any[] = [];
                    let cursor = 0;
                    let match: RegExpExecArray | null;

                    while ((match = combinedRegex.exec(value)) !== null) {
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
                        } else if (match[2] && owner && repo) {
                            const hashRef = match[2];

                            parts.push({
                                type: "link",
                                url: `https://github.com/${owner}/${repo}/issues/${hashRef.slice(1)}`,
                                children: [{ type: "text", value: hashRef }],
                            });
                        }

                        cursor = match.index + match[0].length;
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
