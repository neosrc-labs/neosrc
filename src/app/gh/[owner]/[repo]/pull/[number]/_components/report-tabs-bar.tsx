"use client";

import type { RouterOutputs } from "~/trpc/react";

type Report = RouterOutputs["reports"]["getReportsByPullRequest"][number];

interface ReportTabsBarProps {
    reports: Report[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const TIMELINE_TAB = "__timeline";

export function ReportTabsBar({
    reports,
    activeTab,
    onTabChange,
}: ReportTabsBarProps) {
    return (
        <div className="flex gap-1 border-gray-200 border-b dark:border-zinc-700">
            <button
                type="button"
                onClick={() => onTabChange(TIMELINE_TAB)}
                className={`cursor-pointer rounded-t-md px-3 py-1.5 font-medium text-sm transition-colors ${
                    activeTab === TIMELINE_TAB
                        ? "border-gray-200 border-x border-t bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
            >
                Timeline
            </button>
            {reports.map((report) => (
                <button
                    key={report.name}
                    type="button"
                    onClick={() => onTabChange(report.name)}
                    className={`cursor-pointer rounded-t-md px-3 py-1.5 font-medium text-sm transition-colors ${
                        activeTab === report.name
                            ? "border-gray-200 border-x border-t bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                >
                    {report.title}
                </button>
            ))}
        </div>
    );
}
