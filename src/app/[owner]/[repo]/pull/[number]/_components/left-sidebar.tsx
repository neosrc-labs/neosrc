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
    currentUserLogin?: string;
}

export default function LeftSidebar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    currentUserLogin,
}: LeftSidebarProps) {
    return (
        <aside className="flex h-full flex-col border-gray-200 border-r bg-white px-4 py-6 pr-1 dark:border-zinc-800 dark:bg-zinc-950">
            <SidebarNavMenu number={number} owner={owner} repo={repo} />

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
                number={number}
                owner={owner}
                pullRequestPromise={pullRequestPromise}
                conflictedFilesPromise={conflictedFilesPromise}
                repo={repo}
            />
        </aside>
    );
}
