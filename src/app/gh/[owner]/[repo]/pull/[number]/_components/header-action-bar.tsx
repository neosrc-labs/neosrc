"use client";

import { useState } from "react";
import { Async } from "~/components/async";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { ActionSection } from "./actions-section";
import { StickyActionBar } from "./sticky-action-bar";

interface HeaderActionBarProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
    checkRunsPromise?: Promise<CheckRun[]> | null;
}

export function HeaderActionBar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
    checkRunsPromise,
}: HeaderActionBarProps) {
    const [isSticky, setIsSticky] = useState(false);

    return (
        <StickyActionBar onStickyChange={setIsSticky}>
            <Async
                fallback={null}
                promise={checkRunsPromise ?? Promise.resolve<CheckRun[]>([])}
            >
                {(checkRuns) => (
                    <ActionSection
                        variant="header"
                        isSticky={isSticky}
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
