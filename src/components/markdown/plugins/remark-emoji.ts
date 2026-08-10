import type { Content, Parent, Root } from "mdast";
import { emojify } from "node-emoji";

export function remarkEmojiPlugin() {
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
                parent.type !== "inlineCode" &&
                parent.type !== "code"
            ) {
                const value = node.value;
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
