"use client";

import Link from "next/link";
import { CheckRunIcon } from "~/components/ci-status";
import { UserLink } from "~/components/user/user-link";
import type { WorkflowRunItem } from "~/server/api/routers/actions/types";
import {
    runDurationLabel,
    runPullRequestNumber,
    runStatusLabel,
} from "./actions-display";

function pullRequestHref(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
    number: number,
): string {
    return provider === "cb"
        ? `/cb/${owner}/${repo}/pull/${number}`
        : `/gh/${owner}/${repo}/pull/${number}`;
}

export function WorkflowRunRow({
    run,
    provider,
    owner,
    repo,
}: {
    run: WorkflowRunItem;
    provider: "gh" | "cb";
    owner: string;
    repo: string;
}) {
    const trailing =
        runStatusLabel(run.status, run.conclusion) ?? runDurationLabel(run);
    const pullRequestNumber = runPullRequestNumber(run);

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
                <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="min-w-0 truncate text-text-secondary">
                        {run.name} #{run.runNumber}
                    </span>
                    {pullRequestNumber !== null && (
                        <>
                            <Separator />
                            <Link
                                className="shrink-0 text-text-secondary hover:underline"
                                href={pullRequestHref(
                                    provider,
                                    owner,
                                    repo,
                                    pullRequestNumber,
                                )}
                            >
                                Pull request #{pullRequestNumber}
                            </Link>
                        </>
                    )}
                    {run.actor && (
                        <>
                            <Separator />
                            <UserLink actor={run.actor} provider={provider} />
                        </>
                    )}
                    {run.branch && (
                        <>
                            <Separator />
                            <span className="min-w-0 truncate text-text-muted">
                                {run.branch}
                            </span>
                        </>
                    )}
                </div>
            </div>
            {trailing && (
                <div className="shrink-0 text-text-muted text-xs">
                    {trailing}
                </div>
            )}
        </div>
    );
}

function Separator() {
    return (
        <span aria-hidden="true" className="text-text-muted">
            ·
        </span>
    );
}
