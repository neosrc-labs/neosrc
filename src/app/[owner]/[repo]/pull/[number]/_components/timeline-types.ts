import type { GQLTimelineEvent, GQLActor } from "~/server/github-graphql";

export type LabelChange = {
    label: { name: string; color: string };
    event: "labeled" | "unlabeled";
    actor: GQLActor;
    createdAt: string;
};

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
