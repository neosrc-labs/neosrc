export type PullRequestState = "draft" | "open" | "closed" | "merged";

export function StatusPill({ state }: { state: PullRequestState }) {
    let statusText = "";
    let statusColor = "";

    switch (state) {
        case "merged":
            statusText = "Merged";
            statusColor = "bg-purple-600 text-white";
            break;
        case "open":
            statusText = "Open";
            statusColor = "bg-green-600 text-white";
            break;
        case "draft":
            statusText = "Draft";
            statusColor = "bg-zinc-200 text-zinc-700";
            break;
        case "closed":
            statusText = "Closed";
            statusColor = "bg-red-600 text-white";
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
    state?: string;
    draft?: boolean;
};

export function extractPullRequestState(
    pullRequest: PullRequestLike,
): PullRequestState {
    if (pullRequest.merged) {
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
