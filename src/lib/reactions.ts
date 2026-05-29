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
