"use client";

import type { components } from "@octokit/openapi-types";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";

export type Reaction = components["schemas"]["reaction"];

const reactionEmojis: Record<string, string> = {
	"+1": "👍",
	"-1": "👎",
	laugh: "😄",
	confused: "😕",
	heart: "❤️",
	hooray: "🎉",
	rocket: "🚀",
	eyes: "👀",
};

const reactionOrder: (
	| "+1"
	| "-1"
	| "laugh"
	| "confused"
	| "heart"
	| "hooray"
	| "rocket"
	| "eyes"
)[] = ["+1", "heart", "laugh", "hooray", "confused", "rocket", "eyes", "-1"];

interface ReactionRollupProps {
	reactions?: Reaction[];
	currentUserLogin?: string;
	commentId?: number;
	owner: string;
	repo: string;
	number: number;
	isIssue?: boolean;
}

export function ReactionRollup({
	reactions: initialReactions = [],
	currentUserLogin: propUserLogin = "",
	commentId,
	owner,
	repo,
	number,
	isIssue,
}: ReactionRollupProps) {
	const utils = api.useUtils();

	const { data: issueData } = api.reactions.get.useQuery(
		{ owner, repo, number },
		{ staleTime: 5 * 60 * 1000, enabled: isIssue },
	);

	const reactions = isIssue ? (issueData?.reactions ?? []) : initialReactions;
	const resolvedUserLogin = isIssue
		? (issueData?.currentUserLogin ?? propUserLogin)
		: propUserLogin;

	const issueMutation = api.reactions.toggleIssue.useMutation({
		onMutate: async ({ content }) => {
			await utils.reactions.get.cancel({ owner, repo, number });
			const prevData = utils.reactions.get.getData({
				owner,
				repo,
				number,
			});
			utils.reactions.get.setData({ owner, repo, number }, (old) => {
				if (!old) return old;
				const existing = reactions.find(
					(r) => r.user?.login === resolvedUserLogin && r.content === content,
				);
				const updated = existing
					? reactions.filter((r) => r.id !== existing.id)
					: [
							...reactions,
							{
								id: -Date.now(),
								node_id: "",
								user: {
									login: resolvedUserLogin,
									avatar_url: "",
									html_url: "",
									id: 0,
									node_id: "",
									gravatar_id: "",
									url: "",
									received_events_url: "",
									type: "User",
									site_admin: false,
								},
								content,
								created_at: new Date().toISOString(),
							} as Reaction,
						];
				return { reactions: updated, currentUserLogin: resolvedUserLogin };
			});
			return { prevData };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prevData) {
				utils.reactions.get.setData({ owner, repo, number }, ctx.prevData);
			}
		},
		onSettled: () => {
			utils.reactions.get.invalidate({ owner, repo, number });
		},
	});

	const commentMutation = api.reactions.toggleIssueComment.useMutation({
		onMutate: async ({ content }) => {
			await utils.timeline.list.cancel({
				owner,
				repo,
				number,
				limit: 30,
			});
			const prevData = utils.timeline.list.getInfiniteData({
				owner,
				repo,
				number,
				limit: 30,
			});
			utils.timeline.list.setInfiniteData(
				{ owner, repo, number, limit: 30 },
				(old) => {
					if (!old) return old;
					const existing = reactions.find(
						(r) => r.user?.login === resolvedUserLogin && r.content === content,
					);
					const updatedReactions = existing
						? reactions.filter((r) => r.id !== existing.id)
						: [
								...reactions,
								{
									id: -Date.now(),
									node_id: "",
									user: {
										login: resolvedUserLogin,
										avatar_url: "",
										html_url: "",
										id: 0,
										node_id: "",
										gravatar_id: "",
										url: "",
										received_events_url: "",
										type: "User",
										site_admin: false,
									},
									content,
									created_at: new Date().toISOString(),
								} as Reaction,
							];
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							commentReactions: {
								...page.commentReactions,
								[commentId!]: updatedReactions,
							},
						})),
					};
				},
			);
			return { prevData };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prevData) {
				utils.timeline.list.setInfiniteData(
					{ owner, repo, number, limit: 30 },
					ctx.prevData,
				);
			}
		},
		onSettled: () => {
			utils.timeline.list.invalidate({
				owner,
				repo,
				number,
				limit: 30,
			});
		},
	});

	const grouped = new Map<string, Reaction[]>();
	for (const r of reactions) {
		const existing = grouped.get(r.content) ?? [];
		existing.push(r);
		grouped.set(r.content, existing);
	}

	const entries = reactionOrder
		.map((content) => [content, grouped.get(content) ?? []] as const)
		.filter(([, rs]) => rs.length > 0);

	const userReacted = (content: string) =>
		reactions.some(
			(r) => r.user?.login === resolvedUserLogin && r.content === content,
		);

	const handleToggle = (
		content:
			| "+1"
			| "-1"
			| "laugh"
			| "confused"
			| "heart"
			| "hooray"
			| "rocket"
			| "eyes",
	) => {
		if (isIssue) {
			issueMutation.mutate({ owner, repo, number, content });
		} else {
			commentMutation.mutate({
				owner,
				repo,
				commentId: commentId!,
				content,
			});
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<ReactionPicker
				resolvedUserLogin={resolvedUserLogin}
				handleToggle={handleToggle}
				reactions={reactions}
			/>
			{entries.map(([content, rs]) => {
				const isActive = userReacted(content);
				return (
					<HoverCard key={content} openDelay={300}>
						<HoverCardTrigger asChild>
							<button
								type="button"
								onClick={() => handleToggle(content)}
								className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs transition-colors ${
									isActive
										? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
										: "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
								}`}
							>
								<span>{reactionEmojis[content] ?? content}</span>
								<span>{rs.length}</span>
							</button>
						</HoverCardTrigger>
						<HoverCardContent className="w-56 bg-white p-3 dark:bg-zinc-950">
							<div className="flex flex-col gap-2">
								{rs.map((r) => (
									<div
										key={r.id}
										className="flex items-center gap-2 text-gray-700 text-sm dark:text-gray-300"
									>
										{r.user && (
											<img
												src={r.user.avatar_url}
												alt={r.user.login}
												className="h-5 w-5 rounded-full"
											/>
										)}
										<span className="font-medium">{r.user?.login}</span>
										<span className="ml-auto">{reactionEmojis[r.content]}</span>
									</div>
								))}
							</div>
						</HoverCardContent>
					</HoverCard>
				);
			})}
		</div>
	);
}

const allReactions: (
	| "+1"
	| "-1"
	| "laugh"
	| "confused"
	| "heart"
	| "hooray"
	| "rocket"
	| "eyes"
)[] = ["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"];

function ReactionPicker({
	resolvedUserLogin,
	handleToggle,
	reactions,
}: {
	resolvedUserLogin: string;
	handleToggle: (
		content:
			| "+1"
			| "-1"
			| "laugh"
			| "confused"
			| "heart"
			| "hooray"
			| "rocket"
			| "eyes",
	) => void;
	reactions: Reaction[];
}) {
	const [open, setOpen] = useState(false);
	const available = allReactions.filter(
		(c) =>
			!reactions.some(
				(r) => r.user?.login === resolvedUserLogin && r.content === c,
			),
	);

	if (available.length === 0) return null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 border-dashed px-2 py-0.5 text-gray-400 text-xs transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
				>
					<SmilePlus size={14} />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-fit bg-white p-2 dark:bg-zinc-950">
				<div className="flex gap-1">
					{available.map((content) => (
						<button
							key={content}
							type="button"
							onClick={() => {
								handleToggle(content);
								setOpen(false);
							}}
							className="cursor-pointer rounded p-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
						>
							{reactionEmojis[content] ?? content}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
