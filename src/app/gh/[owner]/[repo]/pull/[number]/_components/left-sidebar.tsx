import { Suspense } from "react";
import type { PullsGetResponseData } from "~/server/github";
import { ActionSection } from "./actions-section";
import {
    LeftSidebarContentSection,
    SidebarNavMenu,
} from "./left-sidebar-client";

interface LeftSidebarProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
}

export default function LeftSidebar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
}: LeftSidebarProps) {
    return (
        <aside
            className="flex h-full flex-col border-gray-200 border-r bg-white px-4 py-6 pr-1 dark:border-zinc-800 dark:bg-zinc-950"
            data-testid="left-sidebar"
        >
            <SidebarNavMenu
                number={number}
                owner={owner}
                repo={repo}
                commentCountPromise={pullRequestPromise?.then(
                    (pr) => pr.comments + pr.review_comments,
                )}
                fileCountPromise={pullRequestPromise?.then(
                    (pr) => pr.changed_files,
                )}
            />

            <div className="min-h-0 flex-1 border-gray-200 border-t pt-4 pr-0 dark:border-zinc-800">
                <Suspense>
                    <LeftSidebarContentSection
                        number={number}
                        owner={owner}
                        pullRequestPromise={pullRequestPromise}
                        repo={repo}
                    />
                </Suspense>
            </div>

            <ActionSection
                currentUserLogin={currentUserLogin}
                userPermissionPromise={userPermissionPromise}
                number={number}
                owner={owner}
                pullRequestPromise={pullRequestPromise}
                conflictedFilesPromise={conflictedFilesPromise}
                repo={repo}
            />
        </aside>
    );
}
