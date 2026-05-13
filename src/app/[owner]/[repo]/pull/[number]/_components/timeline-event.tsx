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
	SquarePen,
	Tag,
	Target,
	Trash2,
	User,
} from "lucide-react";
import { useState } from "react";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { type Reaction, ReactionRollup } from "~/components/ReactionRollup";
import { Label } from "~/components/ui/label";
import { UserHoverCard } from "~/components/user-hover-card";
import type { TimelineEventData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";
import { ReviewComments } from "./review-comments";
import type { TimelineWrapper } from "./timeline-types";

interface TimelineEventProps {
	wrapper: TimelineWrapper;
	owner: string;
	repo: string;
	number: number;
	commentReactions: Record<number, Reaction[]>;
	currentUserLogin: string;
}

type CommentEvent = components["schemas"]["timeline-comment-event"];
type CommittedEvent = components["schemas"]["timeline-committed-event"];
type CrossReferencedEvent =
	components["schemas"]["timeline-cross-referenced-event"];
type AssignedEvent = components["schemas"]["timeline-assigned-issue-event"];
type RenamedEvent = components["schemas"]["renamed-issue-event"];
type StateChangeEvent = components["schemas"]["state-change-issue-event"];
type ReviewEvent = components["schemas"]["timeline-reviewed-event"];
type EventWithDismissedReview =
	components["schemas"]["review-dismissed-issue-event"];
type MilestonedEvent = components["schemas"]["milestoned-issue-event"];
type DemilestonedEvent = components["schemas"]["demilestoned-issue-event"];
type LockedEvent = components["schemas"]["locked-issue-event"];
type ReviewRequestedEvent =
	components["schemas"]["review-requested-issue-event"];
type ReviewRequestRemovedEvent =
	components["schemas"]["review-request-removed-issue-event"];
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
type ReferencedEvent = {
	event: "referenced";
	id: number;
	node_id: string;
	url: string;
	actor: components["schemas"]["simple-user"];
	commit_id: string;
	commit_url: string | null;
	created_at: string;
	performed_via_github_app: components["schemas"]["nullable-integration"];
};

export function TimelineEvent({
	wrapper,
	owner,
	repo,
	number,
	commentReactions,
	currentUserLogin,
}: TimelineEventProps) {
	if (wrapper.type === "aggregated-label") {
		return <AggregatedLabel wrapper={wrapper} />;
	}

	return (
		<div className="relative mb-8 ml-14">
			<div className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700">
				<TimelineIcon event={wrapper.event} />
			</div>

			<div className="pt-1.5">
				<EventContent
					event={wrapper.event}
					owner={owner}
					repo={repo}
					number={number}
					commentReactions={commentReactions}
					currentUserLogin={currentUserLogin}
				/>
			</div>
		</div>
	);
}

function AggregatedLabel({
	wrapper,
}: {
	wrapper: Extract<TimelineWrapper, { type: "aggregated-label" }>;
}) {
	const { actor, changes, createdAt } = wrapper;
	const timestamp = formatRelativeTime(createdAt);
	const added = changes.filter((c) => c.event === "labeled");
	const removed = changes.filter((c) => c.event === "unlabeled");
	const total = changes.length;

	return (
		<div className="relative mb-8 ml-14">
			<div className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700">
				<Tag size={18} />
			</div>
			<div className="flex flex-wrap items-center gap-1.5 text-gray-600 text-sm dark:text-zinc-400">
				<UserHoverCard login={actor.login}>
					<a className="flex items-center gap-1.5" href={actor.html_url}>
						<img
							src={actor.avatar_url}
							alt={actor.login}
							className="h-5 w-5 rounded-full"
						/>
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{actor.login}
						</span>
					</a>
				</UserHoverCard>
				{added.length > 0 && (
					<>
						{" added "}
						{added.map((c, i) => (
							<span key={c.label.name}>
								{i > 0 && i === added.length - 1 ? " and " : i > 0 ? ", " : ""}
								<Label color={c.label.color}>{c.label.name}</Label>
							</span>
						))}
					</>
				)}
				{added.length > 0 && removed.length > 0 && " and "}
				{removed.length > 0 && (
					<>
						{" removed "}
						{removed.map((c, i) => (
							<span key={c.label.name}>
								{i > 0 && i === removed.length - 1
									? " and "
									: i > 0
										? ", "
										: ""}
								<Label color={c.label.color}>{c.label.name}</Label>
							</span>
						))}
					</>
				)}
				<span>{` ${total === 1 ? "label" : "labels"} ${timestamp}`}</span>
			</div>
		</div>
	);
}

function TimelineIcon({ event }: { event: TimelineEventData }) {
	const iconMap: Record<string, React.ReactNode> = {
		commented: <MessageSquare size={18} />,
		reviewed: <Eye size={18} />,
		closed: <Circle className="fill-red-500/20 text-red-500" size={18} />,
		reopened: <Circle className="fill-green-500/20 text-green-500" size={18} />,
		merged: <GitMerge className="text-purple-500" size={18} />,
		labeled: <Tag size={18} />,
		unlabeled: <Tag size={18} />,
		assigned: <User size={18} />,
		unassigned: <User size={18} />,
		review_requested: <ClipboardList size={18} />,
		review_request_removed: <ClipboardList size={18} />,
		committed: <GitCommitHorizontal size={18} />,
		renamed: <Pencil size={18} />,
		locked: <Lock size={18} />,
		unlocked: <LockOpen size={18} />,
		milestoned: <Target size={18} />,
		demilestoned: <Target size={18} />,
		"cross-referenced": <Link size={18} />,
		referenced: <Link size={18} />,
		head_ref_deleted: <Trash2 size={18} />,
		head_ref_restored: <RefreshCw size={18} />,
		convert_to_draft: <FileText size={18} />,
		ready_for_review: <CheckCheck size={18} />,
		head_ref_force_pushed: <ArrowUp size={18} />,
	};

	return (
		<span className="flex">
			{iconMap[event.event ?? ""] ?? <Circle size={18} />}
		</span>
	);
}

function EventContent({
	event,
	owner,
	repo,
	number,
	commentReactions,
	currentUserLogin,
}: {
	event: TimelineEventData;
	owner: string;
	repo: string;
	number: number;
	commentReactions: Record<number, Reaction[]>;
	currentUserLogin: string;
}) {
	const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
	const [editBody, setEditBody] = useState("");
	const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});

	const updateCommentMutation = api.pulls.updateComment.useMutation({
		onMutate: ({ commentId, body }) => {
			setSavedBodies((prev) => ({ ...prev, [commentId]: body }));
			setEditingCommentId(null);
		},
		onError: (_, { commentId }) => {
			setSavedBodies((prev) => {
				const next = { ...prev };
				delete next[commentId];
				return next;
			});
			setEditingCommentId(commentId);
		},
	});

	switch (event.event) {
		case "commented": {
			const e = event as CommentEvent;
			if (e.body) {
				const actor = e.actor ?? e.user;
				const timestamp = formatRelativeTime(e.created_at);
				const isEditing = editingCommentId === e.id;
				const isAuthor = actor?.login === currentUserLogin;
				const displayBody = savedBodies[e.id] ?? e.body;
				return (
					<div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900">
						<div className="flex items-center justify-between border-gray-200 border-b px-4 py-2 dark:border-zinc-700">
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
											<span className="font-medium text-gray-800 text-sm dark:text-zinc-200">
												{actor.login}
											</span>
										</a>
									</UserHoverCard>
								)}
								<span className="text-gray-500 text-xs dark:text-zinc-400">
									{timestamp}
								</span>
							</div>
							{!isEditing && isAuthor && (
								<button
									className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									onClick={() => {
										setEditBody(displayBody);
										setEditingCommentId(e.id);
									}}
									type="button"
								>
									<SquarePen size={18} />
								</button>
							)}
						</div>
						<div className="p-4">
							{isEditing ? (
								<MarkdownEditor
									onCancel={() => setEditingCommentId(null)}
									onChange={setEditBody}
									onSubmit={() =>
										updateCommentMutation.mutate({
											owner,
											repo,
											commentId: e.id,
											body: editBody,
										})
									}
									submitLabel="Save"
									value={editBody}
									owner={owner}
									repo={repo}
									minHeight={`${Math.min(Math.max(editBody.split("\n").length * 28, 120), 400)}px`}
								/>
							) : (
								<div className="prose prose-sm max-w-none">
									<MarkdownRenderer
										content={displayBody}
										owner={owner}
										repo={repo}
									/>
								</div>
							)}
						</div>
						{!isEditing && (
							<div className="px-3 pb-3">
								<ReactionRollup
									reactions={commentReactions[e.id] ?? []}
									currentUserLogin={currentUserLogin}
									commentId={e.id}
									owner={owner}
									repo={repo}
									number={number}
								/>
							</div>
						)}
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
						{e.user && (
							<UserHoverCard login={e.user.login}>
								<a className="flex items-center gap-1.5" href={e.user.html_url}>
									<img
										src={e.user.avatar_url}
										alt={e.user.login}
										className="h-5 w-5 rounded-full"
									/>
									<span className="font-medium text-gray-800 dark:text-zinc-200">
										{e.user.login}
									</span>
								</a>
							</UserHoverCard>
						)}
						{` ${stateLabel} ${timestamp}`}
					</p>
					{e.body && (
						<div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
							<div className="prose prose-sm max-w-none">
								<MarkdownRenderer content={e.body} owner={owner} repo={repo} />
							</div>
						</div>
					)}
					<ReviewComments
						owner={owner}
						repo={repo}
						number={number}
						reviewId={e.id}
					/>
				</div>
			);
		}

		case "committed": {
			const e = event as CommittedEvent;
			// TODO: Add author / committer profile pictures here.
			//       We could probably pass in the `commits` which we already load for the commit section in the sidebar
			return (
				<div className="item-center flex justify-between text-gray-600 text-sm dark:text-zinc-400">
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
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
		case "referenced": {
			const e = event as ReferencedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const sha = e.commit_id?.slice(0, 7);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" referenced this "}
						{timestamp}
					</p>
					{sha && (
						<a
							href={e.commit_url ?? undefined}
							target="_blank"
							rel="noreferrer"
							className="font-mono text-xs hover:underline"
						>
							{sha}
						</a>
					)}
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
								<a className="flex items-center gap-2" href={actor.html_url}>
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
							<a className="flex items-center gap-2" href={e.assignee.html_url}>
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
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
							<a className="flex items-center gap-2" href={e.assignee.html_url}>
								<img
									src={e.assignee.avatar_url}
									alt={e.assignee.login}
									className="h-5 w-5 rounded-full"
								/>
								<span className="font-medium text-gray-800 dark:text-zinc-200">
									{e.assignee.login}
								</span>
							</a>
						</UserHoverCard>{" "}
						{timestamp}
					</div>
				</div>
			);
		}
		case "closed":
		case "merged":
		case "reopened":
		case "convert_to_draft":
		case "ready_for_review": {
			const e = event as StateChangeEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const verb =
				event.event === "closed"
					? "closed"
					: event.event === "merged"
						? "merged"
						: event.event === "reopened"
							? "reopened"
							: event.event === "convert_to_draft"
								? "converted to draft"
								: "marked ready for review";
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
		case "milestoned": {
			const e = event as MilestonedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" added the milestone "}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.milestone.title}
						</span>
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		case "demilestoned": {
			const e = event as DemilestonedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" removed the milestone "}
						<span className="font-medium text-gray-800 dark:text-zinc-200">
							{e.milestone.title}
						</span>
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		case "locked": {
			const e = event as LockedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" locked this"}
						{e.lock_reason && (
							<>
								{" (reason: "}
								<span className="font-medium text-gray-800 dark:text-zinc-200">
									{e.lock_reason}
								</span>
								{")"}
							</>
						)}
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		case "unlocked": {
			const e = event as LockedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" unlocked this "}
						{timestamp}
					</p>
				</div>
			);
		}
		case "review_requested": {
			const e = event as ReviewRequestedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const reviewer = e.requested_reviewer;
			const team = e.requested_team;
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" requested a review from "}
						{reviewer && (
							<UserHoverCard login={reviewer.login}>
								<a
									className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-zinc-200"
									href={reviewer.html_url}
								>
									<img
										src={reviewer.avatar_url}
										alt={reviewer.login}
										className="h-4 w-4 rounded-full"
									/>
									{reviewer.login}
								</a>
							</UserHoverCard>
						)}
						{team && (
							<span className="font-medium text-gray-800 dark:text-zinc-200">
								{team.name ?? team.slug}
							</span>
						)}
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		case "review_request_removed": {
			const e = event as ReviewRequestRemovedEvent;
			const timestamp = formatRelativeTime(e.created_at);
			const reviewer = e.requested_reviewer;
			const team = e.requested_team;
			return (
				<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
					<UserHoverCard login={e.actor.login}>
						<a className="flex items-center gap-2" href={e.actor.html_url}>
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
					<p>
						{" removed the review request for "}
						{reviewer && (
							<UserHoverCard login={reviewer.login}>
								<a
									className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-zinc-200"
									href={reviewer.html_url}
								>
									<img
										src={reviewer.avatar_url}
										alt={reviewer.login}
										className="h-4 w-4 rounded-full"
									/>
									{reviewer.login}
								</a>
							</UserHoverCard>
						)}
						{team && (
							<span className="font-medium text-gray-800 dark:text-zinc-200">
								{team.name ?? team.slug}
							</span>
						)}
						{` ${timestamp}`}
					</p>
				</div>
			);
		}
		default:
			console.warn("unknown event type: " + event.event, event);
			return null;
	}
}
