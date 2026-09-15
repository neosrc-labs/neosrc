import { Suspense } from "react";
import type { PullsGetResponseData } from "~/server/github";
import {
    LeftSidebarContentSection,
    SidebarNavMenu,
} from "./left-sidebar-client";

interface LeftSidebarProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export default function LeftSidebar({
    owner,
    repo,
    number,
    pullRequestPromise,
}: LeftSidebarProps) {
    return (
        <aside
            className="flex h-full flex-col border-border-subtle border-r bg-surface px-4 py-6 pr-1"
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

            <div className="flex min-h-0 flex-1 flex-col border-border-subtle border-t pt-4 pr-0">
                <Suspense>
                    <LeftSidebarContentSection
                        number={number}
                        owner={owner}
                        pullRequestPromise={pullRequestPromise}
                        repo={repo}
                    />
                </Suspense>
            </div>
        </aside>
    );
}
