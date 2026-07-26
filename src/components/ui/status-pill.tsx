export type PullRequestState =
    | "draft"
    | "open"
    | "closed"
    | "merged"
    | "queued";

// FIXME: Refactor these types to play nice with both issues and pull requests
export function StatusPill({ state }: { state: PullRequestState | string }) {
    let statusText = "";
    let statusColor = "";

    switch (state) {
        case "merged":
            statusText = "Merged";
            statusColor = "bg-violet-600 text-white";
            break;
        case "open":
            statusText = "Open";
            statusColor = "bg-green-600 text-white";
            break;
        case "draft":
            statusText = "Draft";
            statusColor = "bg-zinc-500 text-white";
            break;
        case "closed":
            statusText = "Closed";
            statusColor = "bg-red-600 text-white";
            break;
        case "queued":
            statusText = "Queued";
            statusColor = "bg-yellow-700 text-white";
            break;
        default:
            console.warn("unsupported state: ", state);
            statusText = "Unknown";
            statusColor = "bg-gray-700 text-white";
            break;
    }
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-sm ${statusColor}`}
        >
            {statusText}
        </span>
    );
}

export type PullRequestLike = {
    merged?: boolean;
    merged_at?: string | null;
    state?: string;
    draft?: boolean;
};

export function extractPullRequestState(
    pullRequest: PullRequestLike,
): PullRequestState {
    if (pullRequest.merged || pullRequest.merged_at) {
        return "merged";
    }
    if (pullRequest.state === "closed") {
        return "closed";
    }
    if (pullRequest.draft) {
        return "draft";
    }

    return "open";
}
