"use client";

import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import type { CheckRun } from "~/server/github";

interface RequiredChecksListProps {
    requiredChecks: string[];
    checks: CheckRun[];
}

export function RequiredChecksList({
    requiredChecks,
    checks,
}: RequiredChecksListProps) {
    if (requiredChecks.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {requiredChecks.map((name) => {
                const check = getCheckStatus(name, checks);
                const conclusion = check?.conclusion;

                let bg =
                    "border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400";
                let Icon = Circle;
                let label = "pending";

                if (conclusion === "success" || conclusion === "neutral") {
                    bg =
                        "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400";
                    Icon = CheckCircle2;
                    label = conclusion === "success" ? "passed" : "skipped";
                } else if (
                    conclusion === "failure" ||
                    conclusion === "timed_out" ||
                    conclusion === "cancelled"
                ) {
                    bg =
                        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400";
                    Icon = XCircle;
                    label = conclusion;
                } else if (
                    check?.status === "in_progress" ||
                    check?.status === "queued"
                ) {
                    Icon = Clock;
                    label = "running";
                }

                return (
                    <a
                        key={name}
                        href={check?.html_url ?? check?.details_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 font-medium text-sm ${bg} transition-opacity hover:opacity-80`}
                    >
                        <Icon size={14} />
                        <span className="max-w-[160px] truncate">{name}</span>
                        <span className="tabular-nums opacity-70">{label}</span>
                    </a>
                );
            })}
        </div>
    );
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

function getCheckStatus(
    name: string,
    checks: CheckRun[],
): CheckRun | undefined {
    const normalized = normalizeName(name);
    return checks.find((c) => normalizeName(c.name) === normalized);
}
