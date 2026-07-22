import {
    Check,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
    MessageSquare,
    TriangleAlert,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import type { StatusContext } from "~/components/ci-status";
import { StatusChecksHoverCard } from "~/components/ci-status";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/code-title";
import { Label } from "~/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { UserLink } from "~/components/user-link";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/utils";

export interface PrRowData {
    id: number;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    user: { login: string; avatar_url: string } | null;
    assignee: { login: string; avatar_url: string } | null;
    labels: Array<{
        id?: number;
        name: string;
        color: string;
        description?: string | null;
    }>;
    created_at: string;
    merged_at: string | null;
    comments_count: number;
    status_state: string | null;
    status_contexts: StatusContext[];
    review_decision: string | null;
    mergeable?: string | null;
}

type PrStatus = "draft" | "open" | "closed" | "merged";

const STATUS_CONFIG: Record<
    PrStatus,
    { icon: typeof GitPullRequest; color: string }
> = {
    draft: {
        icon: GitPullRequestDraft,
        color: "text-text-tertiary",
    },
    open: { icon: GitPullRequest, color: "text-green-600 dark:text-green-500" },
    closed: {
        icon: GitPullRequestClosed,
        color: "text-red-600 dark:text-red-500",
    },
    merged: { icon: GitMerge, color: "text-purple-600 dark:text-purple-500" },
} as const;

export function PullRequestRow({
    pr,
    owner,
    repo,
    provider = "gh",
    onAssigneesFilter,
    onAuthorFilter,
    onLabelFilter,
}: {
    pr: PrRowData;
    owner: string;
    repo: string;
    provider?: "gh" | "cb";
    onAssigneesFilter?: (login: string) => void;
    onAuthorFilter?: (login: string) => void;
    onLabelFilter?: (name: string) => void;
}) {
    const isMerged = pr.merged_at !== null && pr.merged_at !== undefined;
    const status: PrStatus = isMerged
        ? "merged"
        : pr.draft
          ? "draft"
          : (pr.state as "open" | "closed");
    const { icon: StatusIcon, color } = STATUS_CONFIG[status];
    const prHref =
        provider === "gh"
            ? `/gh/${owner}/${repo}/pull/${pr.number}`
            : `https://codeberg.org/${owner}/${repo}/pulls/${pr.number}`;

    return (
        <div className="flex items-start gap-3 border-border-subtle border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900/50">
            <div className="mt-0.5 shrink-0">
                <StatusIcon className={cn("size-4 cursor-pointer", color)} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {pr.draft && (
                        <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 font-medium text-[10px] text-text-secondary uppercase tracking-wide dark:border-zinc-600">
                            Draft
                        </span>
                    )}
                    <Link
                        href={prHref}
                        className="font-medium text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <CodeTitle>{pr.title}</CodeTitle>
                    </Link>
                    {pr.mergeable === "DIRTY" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link
                                    href={prHref}
                                    className="flex items-center"
                                >
                                    <TriangleAlert className="size-4 text-amber-500" />
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                This PR has conflicts
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {pr.status_state && (
                        <StatusChecksHoverCard
                            contexts={pr.status_contexts}
                            className="size-4"
                        />
                    )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                    <span>#{pr.number} opened </span>
                    <span title={new Date(pr.created_at).toLocaleString()}>
                        {formatRelativeTime(pr.created_at)}
                    </span>
                    {pr.user ? (
                        <span className="flex items-center gap-1">
                            by{" "}
                            <UserLink
                                provider={provider}
                                actor={{
                                    login: pr.user.login,
                                    avatarUrl: pr.user.avatar_url,
                                }}
                                onClick={() => {
                                    // biome-ignore lint/style/noNonNullAssertion: guarded by enclosing conditional
                                    onAuthorFilter?.(pr.user!.login);
                                }}
                            />
                        </span>
                    ) : (
                        <span>by unknown</span>
                    )}
                    {pr.review_decision === "APPROVED" && (
                        <span className="flex items-center gap-0.5 text-green-600 text-xs dark:text-green-500">
                            <Check className="size-3.5" />
                            Approved
                        </span>
                    )}
                    {pr.review_decision === "CHANGES_REQUESTED" && (
                        <span className="flex items-center gap-0.5 text-red-600 text-xs dark:text-red-500">
                            <XCircle className="size-3.5" />
                            Changes requested
                        </span>
                    )}
                    {pr.review_decision === "REVIEW_REQUIRED" && (
                        <span className="text-amber-600 text-xs dark:text-amber-500">
                            Review required
                        </span>
                    )}
                </div>
                {pr.labels && pr.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {[...pr.labels]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((label) => (
                                <Label
                                    key={label.id ?? label.name}
                                    color={label.color}
                                    description={label.description ?? undefined}
                                    className="cursor-pointer"
                                    onClick={() => onLabelFilter?.(label.name)}
                                >
                                    {label.name}
                                </Label>
                            ))}
                    </div>
                )}
            </div>
            <div className="flex w-20 shrink-0 items-center justify-center">
                {pr.assignee ? (
                    <UserHoverCard
                        login={pr.assignee.login}
                        provider={provider}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                // biome-ignore lint/style/noNonNullAssertion: guarded by enclosing conditional
                                const login = pr.assignee!.login;
                                onAssigneesFilter?.(login);
                            }}
                            className="cursor-pointer rounded-full"
                        >
                            <img
                                src={pr.assignee.avatar_url}
                                alt={pr.assignee.login}
                                className="size-5 rounded-full"
                            />
                        </button>
                    </UserHoverCard>
                ) : (
                    <span className="size-5" />
                )}
            </div>
            <div className="flex w-16 shrink-0 items-center justify-end">
                {pr.comments_count > 0 ? (
                    <a
                        href={`${prHref}#issuecomment`}
                        className="flex items-center gap-1 text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <MessageSquare className="size-4" />
                        <span>{pr.comments_count}</span>
                    </a>
                ) : (
                    <span className="size-4" />
                )}
            </div>
        </div>
    );
}
