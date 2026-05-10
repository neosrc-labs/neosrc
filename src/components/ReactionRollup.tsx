import type { components } from "@octokit/openapi-types";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";

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

interface ReactionRollupProps {
	reactions: Reaction[];
}

export function ReactionRollup({ reactions }: ReactionRollupProps) {
	const grouped = new Map<string, Reaction[]>();
	for (const r of reactions) {
		const existing = grouped.get(r.content) ?? [];
		existing.push(r);
		grouped.set(r.content, existing);
	}

	const entries = Array.from(grouped.entries()).filter(
		([, rs]) => rs.length > 0,
	);

	if (entries.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5">
			{entries.map(([content, rs]) => (
				<HoverCard key={content} openDelay={300}>
					<HoverCardTrigger asChild>
						<button
							type="button"
							className="inline-flex cursor-default items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-xs hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
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
			))}
		</div>
	);
}
