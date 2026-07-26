"use client";

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
    checkRuns?: CheckRun[];
}

export function InlineActionBar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
    checkRuns,
}: InlineActionBarProps) {
    const mainRef = useMainContentRef();

    return (
        <StickyActionBar measureRef={mainRef ?? undefined}>
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
        </StickyActionBar>
    );
}
