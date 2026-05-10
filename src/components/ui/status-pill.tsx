export type PullRequestState = "draft" | "open" | "closed" | "merged";

export function StatusPill({ state }: { state: PullRequestState }) {
	let statusText = "";
	let statusColor = "";

	switch (state) {
		case "merged":
			statusText = "Merged";
			statusColor = "bg-purple-100 text-purple-800";
			break;
		case "open":
			statusText = "Open";
			statusColor = "bg-green-100 text-green-800";
			break;
		case "draft":
			statusText = "Draft";
			statusColor = "bg-zinc-100 text-zinc-800";
			break;
		case "closed":
			statusText = "Closed";
			statusColor = "bg-red-100 text-red-800";
			break;
	}
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${statusColor}`}
		>
			{statusText}
		</span>
	);
}

export type PullRequestLike = {
	merged?: boolean;
	state?: string;
	draft?: boolean;
};

export function extractPullRequestState(
	pullRequest: PullRequestLike,
): PullRequestState {
	if (pullRequest.draft) {
		return "draft";
	}
	if (pullRequest.merged) {
		return "merged";
	}

	return (pullRequest.state as PullRequestState) ?? "closed";
}
