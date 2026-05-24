export function remarkMentionPlugin() {
    // biome-ignore lint/suspicious/noExplicitAny: FIXME: Should create a dedicated remark node type
    return function transformer(tree: any) {
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: Should create a dedicated remark node type
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
                const mentionRegex =
                    /(?<!\w)@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?))?\b/g;
                const parts: Part[] = [];
                let cursor = 0;
                let match: RegExpExecArray | null;

                match = mentionRegex.exec(value);
                while (match !== null) {
                    if (match.index > cursor) {
                        parts.push({
                            type: "text",
                            value: value.slice(cursor, match.index),
                        });
                    }

                    if (match[2]) {
                        parts.push({
                            type: "link",
                            url: `https://github.com/orgs/${match[1]}/teams/${match[2]}`,
                            children: [{ type: "text", value: match[0] }],
                        });
                    } else {
                        parts.push({
                            type: "link",
                            url: `https://github.com/${match[1]}`,
                            children: [{ type: "text", value: match[0] }],
                        });
                    }

                    cursor = match.index + match[0].length;

                    match = mentionRegex.exec(value);
                }

                if (cursor < value.length) {
                    parts.push({ type: "text", value: value.slice(cursor) });
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
}

type Part =
    | { type: "text"; value: string }
    | { type: "link"; url: string; children: Part[] };
