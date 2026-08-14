"use client";

import { MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
    LazyHoverCard,
    useLazyHoverCardState,
} from "~/components/hovercards/hover-card-shared";
import { CodeTitle } from "~/components/markdown/code-title";
import {
    extractPullRequestState,
    StatusPill,
} from "~/components/ui/status-pill";
import type { IssueGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

function IssueHoverCardContent({
    issue,
    owner,
    repo,
    issueNumber,
}: {
    issue: IssueGetResponseData;
    owner: string;
    repo: string;
    issueNumber: number;
}) {
    const body = issue.body ?? "";
    const truncatedBody =
        body.length > 200
            ? `${body.slice(0, 200).replace(/\s+\S*$/, "")}\u2026`
            : body;

    return (
        <div>
            <div className="flex items-start gap-3 border-border-subtle border-b p-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {issue.pull_request ? (
                            <StatusPill
                                state={extractPullRequestState(
                                    issue.pull_request,
                                )}
                            />
                        ) : (
                            <StatusPill state={issue.state} />
                        )}
                        <span className="text-text-tertiary text-xs">
                            {issue.pull_request ? "Pull Request" : "Issue"}
                        </span>
                    </div>
                    <p className="mt-1 font-semibold text-sm text-text-primary leading-snug">
                        <CodeTitle>{issue.title}</CodeTitle>
                    </p>
                    {issue.user && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <Image
                                alt={issue.user.login}
                                className="h-4 w-4 rounded-full"
                                src={issue.user.avatar_url}
                                width={16}
                                height={16}
                            />
                            <span className="text-text-tertiary text-xs">
                                {issue.user.login}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            {truncatedBody && (
                <div className="border-border-subtle border-b p-3">
                    <p className="line-clamp-3 whitespace-pre-wrap break-words text-text-secondary text-xs leading-relaxed">
                        {truncatedBody}
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-2 p-3 pt-2.5">
                {issue.labels && issue.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {issue.labels
                            .filter(
                                (l): l is { name: string; color: string } =>
                                    typeof l === "object" &&
                                    l !== null &&
                                    typeof (l as { name?: string }).name ===
                                        "string" &&
                                    typeof (l as { color?: string | null })
                                        .color === "string",
                            )
                            .map((label) => (
                                <span
                                    key={label.name}
                                    className="inline-block max-w-[120px] truncate rounded-full px-2 py-0.5 font-medium text-xs"
                                    style={{
                                        backgroundColor: `#${label.color}20`,
                                        color: `#${label.color}`,
                                        borderColor: `#${label.color}40`,
                                        borderWidth: 1,
                                    }}
                                >
                                    {label.name}
                                </span>
                            ))}
                    </div>
                )}
                <div className="flex items-center gap-3 text-text-tertiary text-xs">
                    {issue.comments > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {issue.comments}
                        </span>
                    )}
                    {issue.created_at && (
                        <span>
                            Created {formatRelativeTime(issue.created_at)}
                        </span>
                    )}
                </div>
                <Link
                    className="text-blue-600 text-xs hover:text-blue-800 hover:underline dark:text-blue-400"
                    href={`/${owner}/${repo}/${issue.pull_request ? "pull" : "issues"}/${issueNumber}`}
                >
                    View &rarr;
                </Link>
            </div>
        </div>
    );
}

interface IssueHoverCardProps {
    owner: string;
    repo: string;
    issueNumber: number;
    children: ReactNode;
}

export function IssueHoverCard({
    owner,
    repo,
    issueNumber,
    children,
}: IssueHoverCardProps) {
    const { open, hasBeenHovered, handleOpenChange } = useLazyHoverCardState();

    const { data } = api.issues.getByNumber.useQuery(
        { owner, repo, issueNumber },
        {
            staleTime: 5 * 60 * 1000,
            enabled: hasBeenHovered,
        },
    );

    return (
        <LazyHoverCard
            open={open && !!data}
            onOpenChange={handleOpenChange}
            content={
                data && (
                    <IssueHoverCardContent
                        issue={data as IssueGetResponseData}
                        owner={owner}
                        repo={repo}
                        issueNumber={issueNumber}
                    />
                )
            }
        >
            {children}
        </LazyHoverCard>
    );
}
