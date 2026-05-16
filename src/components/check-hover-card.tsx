"use client";

import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { CheckRun } from "~/server/github";

function formatDuration(
    startedAt: string,
    completedAt?: string | null,
): string {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffMs = end - start;
    if (diffMs < 0) return "";

    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    if (min > 0) {
        return `${min}m ${sec}s`;
    }
    return `${sec}s`;
}

function statusLabel(status: string, conclusion: string | null): string {
    if (status === "queued") return "Queued";
    if (status === "in_progress") return "In progress";
    if (status === "completed") {
        switch (conclusion) {
            case "success":
                return "Passed";
            case "failure":
                return "Failed";
            case "neutral":
                return "Completed";
            case "cancelled":
                return "Cancelled";
            case "skipped":
                return "Skipped";
            case "timed_out":
                return "Timed out";
            case "action_required":
                return "Action required";
            default:
                return "Completed";
        }
    }
    return status;
}

function StatusIcon({ check }: { check: CheckRun }) {
    if (check.conclusion === "success") {
        return <span className="text-green-600">✓</span>;
    }
    if (check.conclusion === "failure") {
        return <span className="text-red-600">✗</span>;
    }
    if (check.status === "in_progress") {
        return <span className="text-gray-400">⏳</span>;
    }
    return <span className="text-gray-400">○</span>;
}

const statusColors: Record<string, string> = {
    success: "text-green-600",
    failure: "text-red-600",
    neutral: "text-gray-600",
    cancelled: "text-gray-500",
    skipped: "text-gray-500",
    timed_out: "text-red-600",
    action_required: "text-yellow-600",
};

function CheckHoverCardContent({ check }: { check: CheckRun }) {
    const labelColor =
        check.conclusion && statusColors[check.conclusion]
            ? statusColors[check.conclusion]
            : "text-gray-600";

    return (
        <div>
            <div className="flex items-start gap-3 border-gray-200 border-b p-3 dark:border-zinc-800">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <StatusIcon check={check} />
                        <span className="truncate font-semibold text-gray-900 text-sm dark:text-gray-100">
                            {check.name}
                        </span>
                    </div>
                    {check.app?.name && (
                        <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
                            {check.app.name}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3 pt-2.5">
                <div className="flex items-center gap-2 text-gray-700 text-xs dark:text-gray-300">
                    <span className={`font-medium ${labelColor}`}>
                        {statusLabel(check.status, check.conclusion)}
                    </span>
                </div>
                {check.started_at && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs dark:text-gray-400">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                            {check.status === "in_progress"
                                ? `Running for ${formatDuration(check.started_at)}`
                                : check.completed_at
                                  ? `Took ${formatDuration(check.started_at, check.completed_at)}`
                                  : `Started ${formatDuration(check.started_at)} ago`}
                        </span>
                    </div>
                )}
                {check.html_url && (
                    <a
                        className="mt-1 text-blue-600 text-xs hover:text-blue-800 hover:underline dark:text-blue-400"
                        href={check.html_url}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        View details →
                    </a>
                )}
            </div>
        </div>
    );
}

interface CheckHoverCardProps {
    check: CheckRun;
    children: ReactNode;
}

export function CheckHoverCard({ check, children }: CheckHoverCardProps) {
    return (
        <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-72 bg-white p-0 dark:bg-zinc-950">
                <CheckHoverCardContent check={check} />
            </HoverCardContent>
        </HoverCard>
    );
}
