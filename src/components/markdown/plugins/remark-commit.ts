import type { Root } from "mdast";
import { matchToParts, transformTextNodes } from "./plugin-utils";

const COMMIT_REGEX = /\b([0-9a-f]{7,40})\b/gi;
const TEXT_PARENT_EXCLUSIONS = ["link", "inlineCode", "code"];

export function remarkCommitPlugin(owner?: string, repo?: string) {
    return function attacher() {
        return function transformer(tree: Root) {
            transformTextNodes(tree, TEXT_PARENT_EXCLUSIONS, (value) =>
                matchToParts(value, COMMIT_REGEX, (match) => {
                    if (match[1] && owner && repo) {
                        const sha = match[1].toLowerCase();
                        return [
                            {
                                type: "link",
                                url: `https://github.com/${owner}/${repo}/commit/${sha}`,
                                children: [{ type: "text", value: match[1] }],
                            },
                        ];
                    }
                    return [];
                }),
            );
        };
    };
}
