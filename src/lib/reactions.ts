export const ALL_REACTIONS = [
    "+1",
    "-1",
    "laugh",
    "confused",
    "heart",
    "hooray",
    "rocket",
    "eyes",
] as const;

export type ReactionContent = (typeof ALL_REACTIONS)[number];

export const REACTION_EMOJIS: Record<string, string> = {
    "+1": "👍",
    "-1": "👎",
    laugh: "😄",
    confused: "😕",
    heart: "❤️",
    hooray: "🎉",
    rocket: "🚀",
    eyes: "👀",
};

export const REACTION_ORDER: ReactionContent[] = [
    "+1",
    "heart",
    "laugh",
    "hooray",
    "confused",
    "rocket",
    "eyes",
    "-1",
];

import type { GQLReactionNode } from "~/server/github-graphql";

export function toggleReactionInList(
    items: GQLReactionNode[],
    login: string,
    content: string,
): GQLReactionNode[] {
    const existing = items.find(
        (r) => r.user?.login === login && r.content === content,
    );
    if (existing) {
        return items.filter((r) => r.databaseId !== existing.databaseId);
    }
    return [
        ...items,
        {
            databaseId: -Date.now(),
            content,
            createdAt: new Date().toISOString(),
            user: { login },
        },
    ];
}
