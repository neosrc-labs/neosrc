"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { api } from "~/trpc/react";
import { ReportTabsBar } from "./report-tabs-bar";

interface PullRequestContentProps {
    owner: string;
    repo: string;
    number: number;
    timeline: ReactNode;
}

const TIMELINE_TAB = "__timeline";

export function PullRequestContent({
    owner,
    repo,
    number,
    timeline,
}: PullRequestContentProps) {
    const { data: reports } = api.reports.getReportsByPullRequest.useQuery({
        provider: "gh",
        repository: `${owner}/${repo}`,
        prNumber: number,
    });

    const [activeTab, setActiveTab] = useState<string>(TIMELINE_TAB);

    if (!reports || reports.length === 0) {
        return <div className="mt-4">{timeline}</div>;
    }

    const activeReport = reports.find((r) => r.name === activeTab);

    return (
        <div className="mt-4">
            <ReportTabsBar
                reports={reports}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {activeTab === TIMELINE_TAB ? (
                timeline
            ) : activeReport ? (
                <div className="rounded-b-lg border-gray-200 border-x border-b bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
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
