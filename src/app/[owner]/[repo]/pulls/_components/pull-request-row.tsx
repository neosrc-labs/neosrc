import {
    Check,
    Circle,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Loader2,
    MessageSquare,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Label } from "~/components/ui/label";
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
    labels: Array<{ id?: number; name: string; color: string }>;
    created_at: string;
    merged_at: string | null;
    comments_count: number;
    status_state: string | null;
    status_contexts: Array<{
        name: string;
        state: string;
        description: string | null;
        url: string | null;
    }>;
}

function StatusCheckIcon({
    state,
    className,
}: {
    state: string;
    className?: string;
}) {
    if (state === "SUCCESS") {
        return <Check className={cn(className, "text-green-600")} />;
    }
    if (state === "FAILURE" || state === "ERROR" || state === "TIMED_OUT") {
        return <XCircle className={cn(className, "text-red-600")} />;
    }
    if (state === "IN_PROGRESS") {
        return (
            <Loader2
                className={cn(className, "animate-spin text-yellow-500")}
            />
        );
    }
    return <Circle className={cn(className, "text-gray-400")} />;
}

function StatusContextRow({
    context,
}: {
    context: {
        name: string;
        state: string;
        description: string | null;
        url: string | null;
    };
}) {
    const linkProps = context.url
        ? { href: context.url, target: "_blank", rel: "noreferrer" }
        : {};

    return (
        <a
            {...linkProps}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
            <StatusCheckIcon
                state={context.state}
                className="size-3.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                    {context.name}
                </div>
                {context.description && (
                    <div className="truncate text-gray-500 dark:text-gray-400">
                        {context.description}
                    </div>
                )}
            </div>
        </a>
    );
}

type PrStatus = "draft" | "open" | "closed" | "merged";

const STATUS_CONFIG: Record<
    PrStatus,
    { icon: typeof GitPullRequest; color: string }
> = {
    draft: {
        icon: GitPullRequestDraft,
        color: "text-gray-500 dark:text-gray-400",
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
    onAssigneesFilter,
    onAuthorFilter,
    onLabelFilter,
}: {
    pr: PrRowData;
    owner: string;
    repo: string;
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

    return (
        <div className="flex items-start gap-3 border-gray-200 border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
            <div className="mt-0.5 shrink-0">
                <StatusIcon className={cn("size-4 cursor-pointer", color)} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {pr.draft && (
                        <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 font-medium text-[10px] text-gray-600 uppercase tracking-wide dark:border-zinc-600 dark:text-gray-400">
                            Draft
                        </span>
                    )}
                    <Link
                        href={`/${owner}/${repo}/pull/${pr.number}`}
                        className="font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                    >
                        {pr.title}
                    </Link>
                    {pr.status_state && (
                        <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                                <button
                                    type="button"
                                    className="cursor-pointer"
                                    tabIndex={-1}
                                >
                                    <StatusCheckIcon
                                        state={pr.status_state}
                                        className="size-4"
                                    />
                                </button>
                            </HoverCardTrigger>
                            <HoverCardContent
                                align="start"
                                side="bottom"
                                className="w-72 bg-white p-3 dark:bg-zinc-950"
                            >
                                <div className="space-y-1.5">
                                    {pr.status_contexts.map((ctx) => (
                                        <StatusContextRow
                                            key={ctx.name}
                                            context={ctx}
                                        />
                                    ))}
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-gray-600 text-sm dark:text-gray-400">
                    <span>#{pr.number} opened </span>
                    <span>{formatRelativeTime(pr.created_at)}</span>
                    {pr.user ? (
                        <span className="flex items-center gap-1">
                            by{" "}
                            <UserLink
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
                </div>
                {pr.labels && pr.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {[...pr.labels]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((label) => (
                                <Label
                                    key={label.id ?? label.name}
                                    color={label.color}
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
                    <UserHoverCard login={pr.assignee.login}>
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
                        href={`/${owner}/${repo}/pull/${pr.number}#issuecomment`}
                        className="flex items-center gap-1 text-gray-500 text-sm hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
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
