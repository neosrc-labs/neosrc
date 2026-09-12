"use client";

import Image from "next/image";
import { CheckRunIcon } from "~/components/ci-status";
import { CheckHoverCard } from "~/components/hovercards/check-hover-card";
import { GitHubIcon } from "~/components/icons";
import type { CheckRun } from "~/server/github";
import { bucketChecks } from "./check-groups";

export function ChecksSection({ checks }: { checks: Array<CheckRun> }) {
    if (checks.length === 0) {
        return <p className="text-sm text-text-tertiary">No checks</p>;
    }

    return (
        <div className="space-y-4">
            {bucketChecks(checks).map((group) => (
                <section key={group.label}>
                    <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold text-text-secondary text-xs uppercase">
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                        />
                        {group.label} ({group.checks.length})
                    </h3>
                    <div className="space-y-2">
                        {group.checks.map((check) => (
                            <CheckRow
                                check={check}
                                key={check.html_url ?? check.name}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function CheckRow({ check }: { check: CheckRun }) {
    return (
        <CheckHoverCard check={check}>
            <a
                className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-surface-tertiary"
                href={check.html_url}
                rel="noopener noreferrer"
                target="_blank"
            >
                <span className="flex shrink-0 items-center gap-2">
                    <CheckRunIcon
                        status={check.status}
                        conclusion={check.conclusion}
                        className="size-3.5 shrink-0"
                    />
                    {check.app?.name === "GitHub Actions" ? (
                        <GitHubIcon className="size-5 text-text-primary" />
                    ) : check.creator?.avatar_url ? (
                        <Image
                            src={check.creator.avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full"
                            width={20}
                            height={20}
                        />
                    ) : check.app?.owner?.avatar_url ? (
                        <Image
                            src={check.app.owner.avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full"
                            width={20}
                            height={20}
                        />
                    ) : null}
                </span>
                <span className="min-w-0 truncate text-sm text-text-label">
                    {check.name}
                    {check.description && (
                        <span className="text-text-tertiary">
                            {" "}
                            - {check.description}
                        </span>
                    )}
                </span>
            </a>
        </CheckHoverCard>
    );
}
