import type { GQLActor, GQLTimelineEvent } from "~/server/github-graphql";

export type LabelChange = {
    label: { name: string; color: string; description: string | null };
    event: "labeled" | "unlabeled";
    actor: GQLActor;
    createdAt: string;
};

/* @knip-ignore */
export type AggregatedLabelEvent = {
    type: "aggregated-label";
    changes: LabelChange[];
    actor: GQLActor;
    createdAt: string;
};

export type RawEventWrapper = {
    type: "raw";
    event: GQLTimelineEvent;
};

export type TimelineWrapper = RawEventWrapper | AggregatedLabelEvent;
