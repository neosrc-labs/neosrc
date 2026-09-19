export type PullRequestState =
    | "draft"
    | "open"
    | "closed"
    | "merged"
    | "queued";

// FIXME: Refactor these types to play nice with both issues and pull requests
export function StatusPill({
    state,
    size = "sm",
}: {
    state: PullRequestState | string;
    size?: "sm" | "xs";
}) {
    let statusText = "";
    let statusColor = "";

    switch (state) {
        case "merged":
            statusText = "Merged";
            statusColor = "bg-state-merged-solid text-state-solid-foreground";
            break;
        case "open":
            statusText = "Open";
            statusColor = "bg-state-open text-state-foreground";
            break;
        case "draft":
            statusText = "Draft";
            statusColor = "bg-state-draft text-state-foreground";
            break;
        case "closed":
            statusText = "Closed";
            statusColor = "bg-state-closed text-state-foreground";
            break;
        case "queued":
            statusText = "Queued";
            statusColor = "bg-state-queued text-state-foreground";
            break;
        default:
            console.warn("unsupported state: ", state);
            statusText = "Unknown";
            statusColor = "bg-state-unknown text-state-foreground";
            break;
    }
    return (
        <span
            className={`inline-flex items-center rounded-full font-medium ${
                size === "xs" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
            } ${statusColor}`}
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
