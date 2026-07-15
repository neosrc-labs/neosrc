"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Async } from "~/components/async";
import { CommitSubject } from "~/components/commit-subject";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import { api } from "~/trpc/react";
import { ReportTabsBar } from "./report-tabs-bar";

interface PullRequestContentProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<{ head: { sha: string } }>;
    timeline: ReactNode;
}

const TIMELINE_TAB = "__timeline";

export function PullRequestContent({
    owner,
    repo,
    number,
    pullRequestPromise,
    timeline,
}: PullRequestContentProps) {
    const { data: reports } = api.reports.getReportsByPullRequest.useQuery({
        provider: "gh",
        repository: `${owner}/${repo}`,
        prNumber: number,
    });

    const [activeTab, setActiveTab] = useState<string>(TIMELINE_TAB);

    const activeReport = reports?.find((r) => r.name === activeTab);

    const isManuallyOutdated = activeReport?.state === "OUTDATED";

    const { data: reportCommit } = api.commits.getBySha.useQuery(
        { owner, repo, sha: activeReport?.commitSha ?? "" },
        { enabled: !!activeReport?.commitSha },
    );

    if (!reports || reports.length === 0) {
        return (
            <div className="mt-4" data-testid="timeline">
                {timeline}
            </div>
        );
    }

    return (
        <div className="mt-4" data-testid="timeline">
            <ReportTabsBar
                reports={reports}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {activeTab === TIMELINE_TAB ? (
                timeline
            ) : activeReport ? (
                <div className="relative rounded-b-lg border-gray-200 border-x border-b bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="absolute top-3 right-4 flex items-center gap-2">
                        {isManuallyOutdated && (
                            <HoverCard>
                                <HoverCardTrigger asChild>
                                    <span className="cursor-default rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                                        Outdated
                                    </span>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-72 space-y-2 bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">
                                    <p className="text-gray-600 text-xs dark:text-zinc-400">
                                        This report was manually marked as
                                        outdated
                                    </p>
                                </HoverCardContent>
                            </HoverCard>
                        )}
                        {!isManuallyOutdated && activeReport?.commitSha && (
                            <Async promise={pullRequestPromise} fallback={null}>
                                {(pr) => {
                                    const sha = activeReport.commitSha;
                                    if (!sha || sha === pr.head.sha) {
                                        return null;
                                    }
                                    return (
                                        <HoverCard>
                                            <HoverCardTrigger asChild>
                                                <span className="cursor-default rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                                                    Outdated
                                                </span>
                                            </HoverCardTrigger>
                                            <HoverCardContent className="w-72 space-y-2 bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">
                                                <div>
                                                    <div className="mb-1 font-medium text-gray-500 text-xs uppercase tracking-wide">
                                                        Report commit
                                                    </div>
                                                    <div className="font-mono text-xs">
                                                        {sha.slice(0, 7)}
                                                    </div>
                                                    <div className="truncate text-gray-600 text-xs dark:text-zinc-400">
                                                        <CommitSubject
                                                            message={
                                                                reportCommit
                                                                    ?.commit
                                                                    .message ??
                                                                ""
                                                            }
                                                            className="truncate"
                                                        />
                                                    </div>
                                                    {reportCommit?.commit
                                                        .authors[0] && (
                                                        <div className="text-gray-500 text-xs">
                                                            {
                                                                reportCommit
                                                                    .commit
                                                                    .authors[0]
                                                                    .name
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="mb-1 font-medium text-gray-500 text-xs uppercase tracking-wide">
                                                        Latest PR commit
                                                    </div>
                                                    <div className="font-mono text-xs">
                                                        {pr.head.sha.slice(
                                                            0,
                                                            7,
                                                        )}
                                                    </div>
                                                    <div className="text-gray-500 text-xs">
                                                        This commit is newer
                                                        than the report
                                                    </div>
                                                </div>
                                            </HoverCardContent>
                                        </HoverCard>
                                    );
                                }}
                            </Async>
                        )}
                        {activeReport.sourceUrl && (
                            <a
                                href={activeReport.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-gray-500 text-xs hover:text-gray-700 dark:text-zinc-400 dark:hover:text-gray-200"
                            >
                                <ExternalLink className="size-3" />
                                Source
                            </a>
                        )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                        <MarkdownRenderer
                            content={activeReport.data ?? ""}
                            owner={owner}
                            repo={repo}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
