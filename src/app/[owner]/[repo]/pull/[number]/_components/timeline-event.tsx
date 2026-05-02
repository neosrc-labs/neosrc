"use client";

import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import type { TimelineEventData } from "~/server/github";

interface TimelineEventProps {
	event: TimelineEventData;
}

type EventWithLabel = TimelineEventData & {
	label?: { name: string; color: string };
};
type EventWithAssignee = TimelineEventData & { assignee?: { login: string } };
type EventWithMilestone = TimelineEventData & { milestone?: { title: string } };
type EventWithRename = TimelineEventData & {
	rename?: { from: string; to: string };
};
type EventWithSha = TimelineEventData & { sha?: string; message?: string };
type EventWithBody = TimelineEventData & { body?: string; state?: string };
type EventWithDismissedReview = TimelineEventData & {
	dismissed_review?: { dismissal_message?: string | null };
};

export function TimelineEvent({ event }: TimelineEventProps) {
	const actor = event.actor;
	const createdAt = new Date(event.created_at).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<div className="relative mb-4 ml-12">
			<div className="absolute -left-9 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
				<TimelineIcon event={event.event} />
			</div>

			{actor && (
				<img
					alt={actor.login}
					className="absolute -left-12 h-8 w-8 rounded-full"
					src={actor.avatar_url}
				/>
			)}

			<div className="rounded-lg border border-gray-200 bg-white p-4">
				<div className="mb-2 flex items-center gap-2 text-sm">
					<span className="font-semibold">{actor?.login ?? "Unknown"}</span>
					<span className="text-gray-600">{getEventDescription(event)}</span>
					<span className="text-gray-400">{createdAt}</span>
				</div>

				{renderEventContent(event)}
			</div>
		</div>
	);
}

function TimelineIcon({ event }: { event: string }) {
	const iconMap: Record<string, string> = {
		commented: "💬",
		reviewed: "👀",
		closed: "🔴",
		reopened: "🟢",
		merged: "🟣",
		labeled: "🏷️",
		unlabeled: "🏷️",
		assigned: "👤",
		unassigned: "👤",
		review_requested: "📋",
		review_request_removed: "📋",
		committed: "📝",
		renamed: "✏️",
		locked: "🔒",
		unlocked: "🔓",
		milestoned: "🎯",
		demilestoned: "🎯",
		"cross-referenced": "🔗",
		referenced: "🔗",
		head_ref_deleted: "🗑️",
		head_ref_restored: "♻️",
		convert_to_draft: "📄",
		ready_for_review: "✅",
	};
	return <span className="text-xs">{iconMap[event] ?? "●"}</span>;
}

function getEventDescription(event: TimelineEventData): string {
	switch (event.event) {
		case "commented":
			return "commented";
		case "reviewed": {
			const e = event as EventWithBody;
			return `reviewed (${e.state ?? "commented"})`;
		}
		case "closed":
			return event.commit_id ? "closed with commit" : "closed";
		case "reopened":
			return "reopened";
		case "merged":
			return "merged";
		case "labeled": {
			const e = event as EventWithLabel;
			return `added label "${e.label?.name ?? ""}"`;
		}
		case "unlabeled": {
			const e = event as EventWithLabel;
			return `removed label "${e.label?.name ?? ""}"`;
		}
		case "assigned": {
			const e = event as EventWithAssignee;
			return `assigned ${e.assignee?.login ?? ""}`;
		}
		case "unassigned": {
			const e = event as EventWithAssignee;
			return `unassigned ${e.assignee?.login ?? ""}`;
		}
		case "review_requested":
			return "requested review";
		case "review_request_removed":
			return "removed review request";
		case "committed":
			return "added commit";
		case "renamed": {
			const e = event as EventWithRename;
			return `renamed from "${e.rename?.from}" to "${e.rename?.to}"`;
		}
		case "locked":
			return "locked";
		case "unlocked":
			return "unlocked";
		case "milestoned": {
			const e = event as EventWithMilestone;
			return `added to milestone "${e.milestone?.title ?? ""}"`;
		}
		case "demilestoned": {
			const e = event as EventWithMilestone;
			return `removed from milestone "${e.milestone?.title ?? ""}"`;
		}
		case "cross-referenced":
			return "referenced this issue";
		case "referenced":
			return "referenced from commit";
		case "head_ref_deleted":
			return "deleted the head branch";
		case "head_ref_restored":
			return "restored the head branch";
		case "convert_to_draft":
			return "converted to draft";
		case "ready_for_review":
			return "marked as ready for review";
		case "review_dismissed":
			return "dismissed a review";
		default:
			return event.event;
	}
}

function renderEventContent(event: TimelineEventData) {
	switch (event.event) {
		case "commented":
		case "reviewed": {
			const e = event as EventWithBody;
			if (e.body) {
				return (
					<div className="prose prose-sm max-w-none">
						<MarkdownRenderer content={e.body} />
					</div>
				);
			}
			return null;
		}

		case "labeled":
		case "unlabeled": {
			const e = event as EventWithLabel;
			if (e.label) {
				return (
					<span
						className="inline-block rounded-full px-2 py-1 font-medium text-xs"
						style={{
							backgroundColor: `#${e.label.color}20`,
							color: `#${e.label.color}`,
						}}
					>
						{e.label.name}
					</span>
				);
			}
			return null;
		}

		case "committed": {
			const e = event as EventWithSha;
			return (
				<div className="text-gray-600 text-sm">
					<code className="text-xs">{e.sha?.slice(0, 7)}</code>
					{e.message && <p className="mt-1">{e.message.split("\n")[0]}</p>}
				</div>
			);
		}

		case "review_dismissed": {
			const e = event as EventWithDismissedReview;
			if (e.dismissed_review?.dismissal_message) {
				return (
					<p className="text-gray-600 text-sm">
						{e.dismissed_review.dismissal_message}
					</p>
				);
			}
			return null;
		}

		default:
			return null;
	}
}
