import type { Root } from "mdast";
import { matchToParts, transformTextNodes } from "./plugin-utils";

const ISSUE_REGEX = /(\b[\w.-]+\/[\w.-]+#\d+\b)|(?<!\w)(#\d+)\b/g;
const TEXT_PARENT_EXCLUSIONS = ["link", "inlineCode", "code"];

export function remarkIssuePlugin(owner?: string, repo?: string) {
    return function attacher() {
        return function transformer(tree: Root) {
            transformTextNodes(tree, TEXT_PARENT_EXCLUSIONS, (value) =>
                matchToParts(value, ISSUE_REGEX, (match) => {
                    if (match[1]) {
                        const str = match[1];
                        const hashIdx = str.lastIndexOf("#");
                        const slashIdx = str.lastIndexOf("/", hashIdx);
                        const matchedOwner = str.slice(0, slashIdx);
                        const matchedRepo = str.slice(slashIdx + 1, hashIdx);
                        const matchedNum = str.slice(hashIdx + 1);

                        return [
                            {
                                type: "link",
                                url: `https://github.com/${matchedOwner}/${matchedRepo}/issues/${matchedNum}`,
                                children: [{ type: "text", value: str }],
                            },
                        ];
                    }
                    if (match[2]) {
                        const hashRef = match[2];
                        if (owner && repo) {
                            return [
                                {
                                    type: "link",
                                    url: `https://github.com/${owner}/${repo}/issues/${hashRef.slice(1)}`,
                                    children: [
                                        { type: "text", value: hashRef },
                                    ],
                                },
                            ];
                        }
                        return [{ type: "text", value: hashRef }];
                    }
                    return [];
                }),
            );
        };
    };
}
