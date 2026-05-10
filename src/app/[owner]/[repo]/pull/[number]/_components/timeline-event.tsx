"use client";

import type { components } from "@octokit/openapi-types";
import {
	ArrowUp,
	Check,
	CheckCheck,
	Circle,
	ClipboardList,
	Eye,
	FileText,
	GitCommitHorizontal,
	GitMerge,
	Link,
	Lock,
	LockOpen,
	MessageSquare,
	Pencil,
	RefreshCw,
	Tag,
	Target,
	Trash2,
	User,
} from "lucide-react";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { Label } from "~/components/ui/label";
import { UserHoverCard } from "~/components/user-hover-card";
import type { TimelineEventData } from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface TimelineEventProps {
	event: TimelineEventData;
	owner: string;
	repo: string;
}

type LabelEvent = components["schemas"]["labeled-issue-event"];
type CommentEvent = components["schemas"]["timeline-comment-event"];
type CommittedEvent = components["schemas"]["timeline-committed-event"];
type CrossReferencedEvent =
	components["schemas"]["timeline-cross-referenced-event"];
type AssignedEvent = components["schemas"]["timeline-assigned-issue-event"];
type RenamedEvent = components["schemas"]["renamed-issue-event"];
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

export function TimelineEvent({ event, owner, repo }: TimelineEventProps) {
	return (
		<div className="relative mb-4 ml-12">
			<div className="absolute -left-9 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700">
				<TimelineIcon event={event} />
			</div>

			<EventContent event={event} owner={owner} repo={repo} />
		</div>
	);
}

function TimelineIcon({ event }: { event: TimelineEventData }) {
	const iconMap: Record<string, React.ReactNode> = {
		commented: <MessageSquare size={14} />,
		reviewed: <Eye size={14} />,
		closed: <Circle className="fill-red-500/20 text-red-500" size={14} />,
		reopened: <Circle className="fill-green-500/20 text-green-500" size={14} />,
		merged: <GitMerge className="text-purple-500" size={14} />,
		labeled: <Tag size={14} />,
		unlabeled: <Tag size={14} />,
		assigned: <User size={14} />,
		unassigned: <User size={14} />,
		review_requested: <ClipboardList size={14} />,
		review_request_removed: <ClipboardList size={14} />,
		committed: <GitCommitHorizontal size={14} />,
		renamed: <Pencil size={14} />,
		locked: <Lock size={14} />,
		unlocked: <LockOpen size={14} />,
		milestoned: <Target size={14} />,
		demilestoned: <Target size={14} />,
		"cross-referenced": <Link size={14} />,
		referenced: <Link size={14} />,
		head_ref_deleted: <Trash2 size={14} />,
		head_ref_restored: <RefreshCw size={14} />,
		convert_to_draft: <FileText size={14} />,
		ready_for_review: <CheckCheck size={14} />,
		head_ref_force_pushed: <ArrowUp size={14} />,
	};

	if (event.event === "reviewed") {
		const e = event as ReviewEvent;
		return (
			<UserHoverCard login={e.user.login}>
				<a
					className="flex items-center gap-2"
					href={e.user.html_url}
				>
					<img
						alt={e.user?.login}
						className="h-6 w-6 rounded-full"
						src={e.user?.avatar_url}
					/>
				</a>
			</UserHoverCard>
		);
	}

	if (event.event === "commented") {
		// TODO: Add link to user account
		const e = event as CommentEvent;
		const actor = e.actor;
		return (
			<>
				{actor && (
					<UserHoverCard login={actor.login}>
						<a
							className="flex items-center gap-2"
							href={actor.html_url}
						>
							<img
								alt={actor.login}
								className="h-6 w-6 rounded-full"
								src={actor.avatar_url}
							/>
						</a>
					</UserHoverCard>
				)}
			</>
		);
	}
	return <span className="flex">{iconMap[event.event ?? ""] ?? <Circle size={14} />}</span>;
}

function EventContent({
	event,
	owner,
	repo,
}: {
	event: TimelineEventData;
	owner: string;
	repo: string;
}) {
	switch (event.event) {
		case "commented": {
			const e = event as CommentEvent;
			if (e.body) {
				return (
					<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
						<div className="prose prose-sm max-w-none">
							<MarkdownRenderer content={e.body} owner={owner} repo={repo} />
						</div>
					</div>
				);
			}
			return null;
		}

		case "reviewed": {
			const e = event as ReviewEvent;
			const timestamp = formatRelativeTime(
				e.submitted_at ?? e.updated_at ?? "",
			);
			const isApproved = e.state === "approved";
			const isChangesRequested = e.state === "changes_requested";
			const stateLabel = isApproved
				? "approved these changes"
				: isChangesRequested
					? "requested changes"
					: "reviewed";
			return (
				<div className="text-gray-600 text-sm dark:text-zinc-400">
					<p className="flex items-center gap-1.5">
						{isApproved && <Check className="text-green-500" size={16} />}
						{isChangesRequested && (
							<FileText className="text-red-500" size={16} />
						)}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.user?.login}
						</span>
						{` ${stateLabel} ${timestamp}`}
					</p>
					{e.body && (
						<div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
							<div className="prose prose-sm max-w-none">
								<MarkdownRenderer content={e.body} owner={owner} repo={repo} />
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
					<div className="text-gray-600 text-sm dark:text-zinc-400">
						{added ? "Added the" : "Removed the"}
						<Label color={e.label.color} className="mx-1">
							{e.label.name}
						</Label>
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
				<div className="item-center my-6 flex justify-between text-gray-600 text-sm dark:text-zinc-400">
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
					<p className="text-gray-600 text-sm dark:text-zinc-400">
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
				<div className="my-9 flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a
							className="flex items-center gap-2"
							href={e.actor.html_url}
						>
							<img
								src={e.actor.avatar_url}
								alt={e.actor.login}
								className="h-5 w-5 rounded-full"
							/>
							{e.actor?.login}
						</a>
					</UserHoverCard>
					<p>
						{" force pushed the "}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{branch}
						</span>
						{" branch from "}
						<code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
							{before}
						</code>
						{" to "}
						<code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
							{after}
						</code>
					</p>
					{timestamp}
				</div>
			);
		}
		case "renamed": {
			const e = event as RenamedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<img
						src={e.actor?.avatar_url}
						alt={e.actor?.login ?? ""}
						className="h-5 w-5 rounded-full"
					/>
					<p>
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.actor?.login}
						</span>
						{" renamed this "}
						<span className="font-medium text-gray-800 line-through dark:text-zinc-200">
							{e.rename.from}
						</span>
						{" → "}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.rename.to}
						</span>{" "}
						{timestamp}
					</p>
				</div>
			);
		}
		case "head_ref_deleted":
		case "head_ref_restored": {
			const e = event as any;
			const timestamp = formatRelativeTime(e.created_at);
			const verb = event.event === "head_ref_deleted" ? "deleted" : "restored";
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<img
						src={e.actor.avatar_url}
						alt={e.actor.login}
						className="h-5 w-5 rounded-full"
					/>
					<p>
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.actor.login}
						</span>
						{` ${verb} the `}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							branch
						</span>
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
				<div className="text-gray-600 text-sm dark:text-zinc-400">
					<div className="flex items-center gap-2">
						{actor && (
							<UserHoverCard login={actor.login}>
								<a
									className="flex items-center gap-2"
									href={actor.html_url}
								>
									<img
										src={actor.avatar_url}
										alt={actor.login}
										className="h-5 w-5 rounded-full"
									/>
									<span className="font-medium text-gray-800 dark:text-zinc-200">
										{actor?.login}
									</span>
								</a>
							</UserHoverCard>
						)}
						<span>
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
							<span className="font-medium text-gray-800 dark:text-zinc-200">
								{sourceTitle}
							</span>
							{repoFullName && sourceNumber && (
								<span className="text-gray-400 text-xs dark:text-zinc-500">
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
					<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
						<UserHoverCard login={e.assignee.login}>
							<a
								className="flex items-center gap-2"
								href={e.assignee.html_url}
							>
								<img
									src={e.assignee.avatar_url}
									alt={e.assignee.login}
									className="h-5 w-5 rounded-full"
								/>
								<span className="font-medium text-gray-800 dark:text-zinc-200">
									{e.assignee.login}
								</span>
							</a>
						</UserHoverCard>
						<span>
							{isAssigned
								? " self-assigned this "
								: " removed their assignment "}
							{timestamp}
						</span>
					</div>
				);
			}
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a
							className="flex items-center gap-2"
							href={e.actor.html_url}
						>
							<img
								src={e.actor.avatar_url}
								alt={e.actor.login}
								className="h-5 w-5 rounded-full"
							/>
							<span className="font-medium text-gray-800 dark:text-zinc-200">
								{e.actor.login}
							</span>
						</a>
					</UserHoverCard>
					<div className="flex gap-1">
						{isAssigned ? " assigned " : " unassigned "}
						<UserHoverCard login={e.assignee.login}>
							<a
								className="flex items-center gap-2"
								href={e.assignee.html_url}
							>
								<img
									src={e.assignee.avatar_url}
									alt={e.assignee.login}
									className="h-5 w-5 rounded-full"
								/>
								<span className="font-medium text-gray-800 dark:text-zinc-200">
									{e.assignee.login}
								</span>
							</a>
						</UserHoverCard>
						{" "}
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
			const verb =
				event.event === "closed"
					? "closed"
					: event.event === "merged"
						? "merged"
						: "reopened";
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a
							className="flex items-center gap-2"
							href={e.actor.html_url}
						>
							<img
								src={e.actor?.avatar_url}
								alt={e.actor?.login ?? ""}
								className="h-5 w-5 rounded-full"
							/>

							<span className="font-medium text-gray-800 dark:text-zinc-200">
								{e.actor?.login}
							</span>{" "}
						</a>
					</UserHoverCard>
					<p>
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
