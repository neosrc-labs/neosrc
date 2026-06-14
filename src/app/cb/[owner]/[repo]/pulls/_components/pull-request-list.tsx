"use client";

import { cbConfig } from "~/app/[owner]/[repo]/pulls/_components/pull-request-list-config";
import { PullRequestListShared } from "~/app/[owner]/[repo]/pulls/_components/pull-request-list-shared";

export function PullRequestList({
    owner,
    repo,
    defaultState,
}: {
    owner: string;
    repo: string;
    defaultState: "open" | "closed" | "merged";
}) {
    return (
        <PullRequestListShared
            owner={owner}
            repo={repo}
            defaultState={defaultState}
            config={cbConfig}
        />
    );
}
