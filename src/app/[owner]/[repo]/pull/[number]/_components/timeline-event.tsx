"use client";

import type { components } from "@octokit/openapi-types";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import type { TimelineEventData } from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface TimelineEventProps {
	event: TimelineEventData;
}

type LabelEvent = components["schemas"]["labeled-issue-event"];
type CommentEvent = components["schemas"]["timeline-comment-event"];
type CommittedEvent = components["schemas"]["timeline-committed-event"];
type CrossReferencedEvent =
	components["schemas"]["timeline-cross-referenced-event"];
type AssignedEvent = components["schemas"]["timeline-assigned-issue-event"];
type ForcePushEvent = {
	event: "head_ref_force_pushed";
	id: number;
	node_id: string;
	url: string;
	actor: components["schemas"]["simple-user"];
	commit_id: string;
	commit_url: string | null;
	created_at: string;
	performed_via_github_app: components["schemas"]["nullable-integration"];
};
type StateChangeEvent = components["schemas"]["state-change-issue-event"];
type ReviewEvent = components["schemas"]["timeline-reviewed-event"];
// TODO: Replace this with the octokit types
type EventWithDismissedReview = TimelineEventData & {
	dismissed_review?: { dismissal_message?: string | null };
};

export function TimelineEvent({ event }: TimelineEventProps) {
	return (
		<div className="relative mb-4 ml-12">
			<div className="absolute -left-9 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-700">
				<TimelineIcon event={event} />
			</div>

			<EventContent event={event} />
		</div>
	);
}

function TimelineIcon({ event }: { event: TimelineEventData }) {
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
		head_ref_force_pushed: "⬆️",
	};

	if (event.event === "reviewed") {
		const e = event as ReviewEvent;
		const state = e.state;
		return (
			<img
				alt={e.user?.login}
				className="h-6 w-6 rounded-full"
				src={e.user?.avatar_url}
				title={state === "approved" ? "Approved" : state === "changes_requested" ? "Changes requested" : "Reviewed"}
			/>
		);
	}

	if (event.event === "commented") {
		// TODO: Add link to user account
		const e = event as CommentEvent;
		const actor = e.actor;
		return (
			<>
				{actor && (
					<img
						alt={actor.login}
						className="h-6 w-6 rounded-full"
						src={actor.avatar_url}
					/>
				)}
			</>
		);
	}
	return <span className="text-xs">{iconMap[event.event ?? ""] ?? "●"}</span>;
}

function EventContent({ event }: { event: TimelineEventData }) {
	switch (event.event) {
		case "commented": {
			const e = event as CommentEvent;
			if (e.body) {
				return (
					<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
						<div className="prose prose-sm max-w-none">
							<MarkdownRenderer content={e.body} />
						</div>
					</div>
				);
			}
			return null;
		}

		case "reviewed": {
			const e = event as ReviewEvent;
			const timestamp = formatRelativeTime(e.submitted_at ?? e.updated_at ?? "");
			const isApproved = e.state === "approved";
			const isChangesRequested = e.state === "changes_requested";
			const stateLabel = isApproved
				? "approved these changes"
				: isChangesRequested
					? "requested changes"
					: "reviewed";
			return (
				<div className="text-gray-600 text-sm dark:text-gray-400">
					<p className="flex items-center gap-1.5">
						{isApproved && (
							<span className="text-green-500 text-base">✓</span>
						)}
						{isChangesRequested && (
							<span className="text-red-500 text-base">📄</span>
						)}
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{e.user?.login}
						</span>
						{` ${stateLabel} ${timestamp}`}
					</p>
					{e.body && (
						<div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
							<div className="prose prose-sm max-w-none">
								<MarkdownRenderer content={e.body} />
							</div>
						</div>
					)}
				</div>
			);
		}

		case "labeled":
		case "unlabeled": {
			const e = event as LabelEvent;
			const added = event.event === "labeled";
			const timestamp = formatRelativeTime(e.created_at);
			if (e.label) {
				return (
					<div className="text-gray-600 text-sm dark:text-gray-400">
						{added ? "Added the" : "Removed the"}
						<span
							className="inline-block rounded-full px-2 py-1 font-medium text-xs"
							style={{
								backgroundColor: `#${e.label.color}20`,
								color: `#${e.label.color}`,
							}}
						>
							{e.label.name}
						</span>
						label {timestamp}
					</div>
				);
			}
			return null;
		}

		case "committed": {
			const e = event as CommittedEvent;
			// TODO: Add author / committer profile pictures here.
			//       We could probably pass in the `commits` which we already load for the commit section in the sidebar
			return (
				<div className="item-center my-6 flex justify-between text-gray-600 text-sm dark:text-gray-400">
					<div>
						<p>{e.message.split("\n")[0]}</p>
					</div>
					<code className="text-xs">{e.sha.slice(0, 7)}</code>
				</div>
			);
		}

		case "review_dismissed": {
			const e = event as EventWithDismissedReview;
			if (e.dismissed_review?.dismissal_message) {
				return (
					<p className="text-gray-600 text-sm dark:text-gray-400">
						{e.dismissed_review.dismissal_message}
					</p>
				);
			}
			return null;
		}
		case "head_ref_force_pushed": {
			const e = event as ForcePushEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const branch = "branch-name"; // FIXME: Get the branch name somehow
			const before = "before"; // FIXME: Get the previous commit somehow
			const after = e.commit_id.slice(0, 7);
			// TODO: Add links for the commits, branch, and author
			return (
				<div className="my-9 flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
					<img
						src={e.actor.avatar_url}
						alt={e.actor.login}
						className="h-5 w-5 rounded-full"
					/>
					<p>
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{e.actor.login}
						</span>
						{" force pushed the "}
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{branch}
						</span>
						{" branch from "}
						<code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
							{before}
						</code>
						{" to "}
						<code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
							{after}
						</code>
					</p>
					{timestamp}
				</div>
			);
		}
		case "head_ref_deleted":
		case "head_ref_restored": {
			const e = event as any;
			const timestamp = formatRelativeTime(e.created_at);
			const verb = event.event === "head_ref_deleted" ? "deleted" : "restored";
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
					<img
						src={e.actor.avatar_url}
						alt={e.actor.login}
						className="h-5 w-5 rounded-full"
					/>
					<p>
						<span className="font-medium text-gray-800 dark:text-gray-200">{e.actor.login}</span>
						{` ${verb} the `}
						<span className="font-medium text-gray-800 dark:text-gray-200">branch</span>
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		case "cross-referenced": {
			const e = event as CrossReferencedEvent;
			const actor = e.actor;
			const timestamp = formatRelativeTime(e.created_at);
			const source = e.source?.issue;
			const repo = source?.repository;
			const repoFullName = repo ? `${repo.owner.login}/${repo.name}` : null;
			const sourceNumber = source?.number;
			const sourceTitle = source?.title;
			const sourceUrl = source?.html_url;
			const isPR = source?.pull_request !== undefined;

			// TODO: Add the source status
			return (
				<div className="text-gray-600 text-sm dark:text-gray-400">
					<div className="flex items-center gap-2">
						{actor && (
							<img
								src={actor.avatar_url}
								alt={actor.login}
								className="h-5 w-5 rounded-full"
							/>
						)}
						<span>
							<span className="font-medium text-gray-800 dark:text-gray-200">
								{actor?.login}
							</span>
							{` mentioned this ${isPR ? "pull request" : "issue"} `}
							{timestamp}
						</span>
					</div>
					{source && (
						<a
							href={sourceUrl ?? undefined}
							target="_blank"
							rel="noreferrer"
							className="mt-1 ml-7 flex w-fit items-center gap-1.5 hover:underline"
						>
							<span className="font-medium text-gray-800 dark:text-gray-200">
								{sourceTitle}
							</span>
							{repoFullName && sourceNumber && (
								<span className="text-gray-400 text-xs dark:text-gray-500">
									{repoFullName}#{sourceNumber}
								</span>
							)}
						</a>
					)}
				</div>
			);
		}
		case "assigned":
		case "unassigned": {
			const e = event as AssignedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const isSelfAssigned = e.actor?.login === e.assignee?.login;
			const isAssigned = event.event === "assigned";

			if (isSelfAssigned) {
				return (
					<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
						<img
							src={e.assignee.avatar_url}
							alt={e.assignee.login}
							className="h-5 w-5 rounded-full"
						/>
						<span>
							<span className="font-medium text-gray-800 dark:text-gray-200">
								{e.assignee.login}
							</span>
							{isAssigned
								? " self-assigned this "
								: " removed their assignment "}
							{timestamp}
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
					<img
						src={e.actor.avatar_url}
						alt={e.actor.login}
						className="h-5 w-5 rounded-full"
					/>
					<div className="flex gap-1">
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{e.actor.login}
						</span>
						{isAssigned ? " assigned " : " unassigned "}
						<img
							src={e.assignee.avatar_url}
							alt={e.assignee.login}
							className="h-5 w-5 rounded-full"
						/>
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{e.assignee.login}
						</span>{" "}
						{timestamp}
					</div>
				</div>
			);
		}
		case "closed":
		case "merged":
		case "reopened": {
			const e = event as StateChangeEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const verb = event.event === "closed" ? "closed" : event.event === "merged" ? "merged" : "reopened";
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
					<img
						src={e.actor?.avatar_url}
						alt={e.actor?.login ?? ""}
						className="h-5 w-5 rounded-full"
					/>
					<p>
						<span className="font-medium text-gray-800 dark:text-gray-200">
							{e.actor?.login}
						</span>
						{" "}
						{verb}
						{" this "}
						{timestamp}
					</p>
				</div>
			);
		}
		default:
			console.warn("unknown event type: " + event.event, event);
			return null;
	}
}
