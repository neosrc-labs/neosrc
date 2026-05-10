import type { components } from "@octokit/openapi-types";

type ReactionRollup = components["schemas"]["reaction-rollup"];

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
	reactions: ReactionRollup;
}

export function ReactionRollup({ reactions }: ReactionRollupProps) {
	const entries = [
		["+1", reactions["+1"]],
		["-1", reactions["-1"]],
		["laugh", reactions.laugh],
		["confused", reactions.confused],
		["heart", reactions.heart],
		["hooray", reactions.hooray],
		["rocket", reactions.rocket],
		["eyes", reactions.eyes],
	] as const;

	const visible = entries.filter(([, count]) => count > 0);

	if (visible.length === 0) return null;

	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{visible.map(([content, count]) => (
				<span
					className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-xs dark:bg-zinc-800 dark:text-gray-400"
					key={content}
				>
					<span>{reactionEmojis[content] ?? content}</span>
					<span>{count}</span>
				</span>
			))}
		</div>
	);
}
