"use client";

import { Async } from "~/components/async";
import { NavItem, NavMenu } from "~/components/ui/nav-menu";

interface IssueLeftSidebarProps {
    owner: string;
    repo: string;
    number: number;
    commentCountPromise: Promise<number | null> | null;
}

export function IssueLeftSidebar({
    owner,
    repo,
    number,
    commentCountPromise,
}: IssueLeftSidebarProps) {
    return (
        <aside
            className="flex h-full flex-col border-border-subtle border-r bg-surface px-4 py-6 pr-1"
            data-testid="left-sidebar"
        >
            <NavMenu>
                <NavItem
                    href={`/gh/${owner}/${repo}/issues/${number}`}
                    isActive
                    label="Conversation"
                    count={
                        commentCountPromise ? (
                            <Async promise={commentCountPromise}>
                                {(c) => c ?? undefined}
                            </Async>
                        ) : undefined
                    }
                />
            </NavMenu>
        </aside>
    );
}
