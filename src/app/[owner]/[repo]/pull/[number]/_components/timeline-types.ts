import type { TimelineEventData } from "~/server/github";

export type LabelChange = {
	label: { name: string; color: string };
	event: "labeled" | "unlabeled";
	actor: { login: string; avatar_url: string; html_url: string };
	createdAt: string;
};

export type AggregatedLabelEvent = {
	type: "aggregated-label";
	changes: LabelChange[];
	actor: { login: string; avatar_url: string; html_url: string };
	createdAt: string;
};

export type RawEventWrapper = {
	type: "raw";
	event: TimelineEventData;
};

export type TimelineWrapper = RawEventWrapper | AggregatedLabelEvent;
