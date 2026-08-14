import type { Root } from "mdast";
import { emojify } from "node-emoji";
import { transformTextNodes } from "./plugin-utils";

const TEXT_PARENT_EXCLUSIONS = ["inlineCode", "code"];

export function remarkEmojiPlugin() {
    return function transformer(tree: Root) {
        transformTextNodes(tree, TEXT_PARENT_EXCLUSIONS, (value) =>
            emojify(value),
        );
    };
}
