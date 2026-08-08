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
            statusColor = "bg-state-merged text-white";
            break;
        case "open":
            statusText = "Open";
            statusColor = "bg-state-open text-white";
            break;
        case "draft":
            statusText = "Draft";
            statusColor = "bg-state-draft text-white";
            break;
        case "closed":
            statusText = "Closed";
            statusColor = "bg-state-closed text-white";
            break;
        case "queued":
            statusText = "Queued";
            statusColor = "bg-state-queued text-white";
            break;
        default:
            console.warn("unsupported state: ", state);
            statusText = "Unknown";
            statusColor = "bg-state-unknown text-white";
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
