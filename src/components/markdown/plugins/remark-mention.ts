import type { Root } from "mdast";
import { matchToParts, transformTextNodes } from "./plugin-utils";

const MENTION_REGEX =
    /(?<!\w)@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?))?\b/g;
const TEXT_PARENT_EXCLUSIONS = ["link", "inlineCode", "code"];

export function remarkMentionPlugin() {
    return function transformer(tree: Root) {
        transformTextNodes(tree, TEXT_PARENT_EXCLUSIONS, (value) =>
            matchToParts(value, MENTION_REGEX, (match) => {
                if (match[2]) {
                    return [
                        {
                            type: "link",
                            url: `https://github.com/orgs/${match[1]}/teams/${match[2]}`,
                            children: [{ type: "text", value: match[0] }],
                        },
                    ];
                }
                return [
                    {
                        type: "link",
                        url: `https://github.com/${match[1]}`,
                        children: [{ type: "text", value: match[0] }],
                    },
                ];
            }),
        );
    };
}
