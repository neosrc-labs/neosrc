"use client";

import { Async } from "~/components/async";
import { useMainContentRef } from "~/components/main-content-ref";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { ActionSection } from "./actions-section";
import { StickyActionBar } from "./sticky-action-bar";

interface InlineActionBarProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
    checkRunsPromise?: Promise<CheckRun[]> | null;
}

export function InlineActionBar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
    checkRunsPromise,
}: InlineActionBarProps) {
    const mainRef = useMainContentRef();

    return (
        <StickyActionBar measureRef={mainRef ?? undefined}>
            <Async
                fallback={null}
                promise={checkRunsPromise ?? Promise.resolve<CheckRun[]>([])}
            >
                {(checkRuns) => (
                    <ActionSection
                        variant="inline"
                        owner={owner}
                        repo={repo}
                        number={number}
                        pullRequestPromise={pullRequestPromise}
                        conflictedFilesPromise={conflictedFilesPromise}
                        userPermissionPromise={userPermissionPromise}
                        currentUserLogin={currentUserLogin}
                        checkRuns={checkRuns}
                    />
                )}
            </Async>
        </StickyActionBar>
    );
}
