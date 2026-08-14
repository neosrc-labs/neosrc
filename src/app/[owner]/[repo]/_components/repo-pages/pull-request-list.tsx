"use client";

import {
    cbConfig,
    ghConfig,
    type PullRequestListConfig,
} from "~/app/[owner]/[repo]/pulls/_components/pull-request-list-config";
import { PullRequestListShared } from "~/app/[owner]/[repo]/pulls/_components/pull-request-list-shared";

export function PullRequestList({
    owner,
    repo,
    defaultState,
    provider = "gh",
    config,
}: {
    owner: string;
    repo: string;
    defaultState: "open" | "closed" | "merged";
    provider?: "gh" | "cb";
    config?: PullRequestListConfig;
}) {
    return (
        <PullRequestListShared
            owner={owner}
            repo={repo}
            defaultState={defaultState}
            config={config ?? (provider === "gh" ? ghConfig : cbConfig)}
        />
    );
}
