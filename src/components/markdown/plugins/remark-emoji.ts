import { emojify } from "node-emoji";

export function remarkEmojiPlugin() {
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
                parent.type !== "inlineCode" &&
                parent.type !== "code"
            ) {
                const value = node.value as string;
                const emojified = emojify(value);

                if (emojified !== value) {
                    const childIndex = parent.children.indexOf(node);
                    if (childIndex !== -1) {
                        parent.children.splice(childIndex, 1, {
                            type: "text",
                            value: emojified,
                        });
                    }
                }
            }
        }

        walk(tree, null);
    };
}
