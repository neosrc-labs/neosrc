"use client";

import Image from "next/image";
import { CheckRunIcon } from "~/components/ci-status";
import type { WorkflowRunItem } from "~/server/api/routers/actions/types";
import { runDurationLabel, runStatusLabel } from "./actions-display";

export function WorkflowRunRow({ run }: { run: WorkflowRunItem }) {
    const trailing =
        runStatusLabel(run.status, run.conclusion) ?? runDurationLabel(run);

    return (
        <div className="flex items-start gap-3 border-border-subtle border-b px-4 py-3">
            <CheckRunIcon
                className="mt-0.5 size-4 shrink-0"
                conclusion={run.conclusion}
                status={run.status}
            />
            <div className="min-w-0 flex-1">
                <a
                    className="block truncate font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                    href={run.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    {run.displayTitle}
                </a>
                <div className="truncate text-text-muted text-xs">
                    {run.name} #{run.runNumber}
                </div>
                {run.actor && (
                    <div className="flex items-center gap-1.5 truncate text-text-secondary text-xs">
                        <Image
                            src={run.actor.avatarUrl}
                            alt=""
                            className="size-4 shrink-0 rounded-full"
                            width={16}
                            height={16}
                        />
                        <span className="truncate">
                            {run.actor.login}
                            {run.branch ? `:${run.branch}` : ""}
                        </span>
                    </div>
                )}
            </div>
            {trailing && (
                <div className="shrink-0 text-text-muted text-xs">
                    {trailing}
                </div>
            )}
        </div>
    );
}
