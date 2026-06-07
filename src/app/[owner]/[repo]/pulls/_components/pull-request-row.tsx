import { GitMerge, GitPullRequest } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";

export interface PrRowData {
    id: number;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    user: { login: string; avatar_url: string } | null;
    labels: Array<{ id?: number; name: string; color: string }>;
    created_at: string;
    merged_at: string | null;
}

function relativeTime(date: string | Date): string {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 5) return `${weeks}w ago`;
    return `${months}mo ago`;
}

const STATUS_COLORS = {
    open: "text-green-600 dark:text-green-500",
    closed: "text-purple-600 dark:text-purple-500",
    merged: "text-purple-600 dark:text-purple-500",
} as const;

export function PullRequestRow({
    pr,
    owner,
    repo,
}: {
    pr: PrRowData;
    owner: string;
    repo: string;
}) {
    const isMerged = pr.merged_at !== null && pr.merged_at !== undefined;
    const status = isMerged ? "merged" : (pr.state as "open" | "closed");

    const StatusIcon = status === "open" ? GitPullRequest : GitMerge;

    return (
        <div className="flex items-start gap-3 border-gray-200 border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
            <div className="mt-0.5 shrink-0">
                <StatusIcon className={cn("size-4", STATUS_COLORS[status])} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link
                        href={`/${owner}/${repo}/pull/${pr.number}`}
                        className="font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                    >
                        {pr.title}
                    </Link>
                    {pr.draft && (
                        <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 font-medium text-[10px] text-gray-600 uppercase tracking-wide dark:border-zinc-600 dark:text-gray-400">
                            Draft
                        </span>
                    )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
                    <span>#{pr.number}</span>
                    <span>by {pr.user?.login ?? "unknown"}</span>
                    <span>{relativeTime(pr.created_at)}</span>
                </div>
                {pr.labels && pr.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {[...pr.labels]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(
                                (label: {
                                    id?: number;
                                    name: string;
                                    color: string;
                                }) => (
                                    <span
                                        key={label.id ?? label.name}
                                        className="inline-block rounded-full px-2 py-0.5 font-medium text-[11px] leading-none"
                                        style={{
                                            backgroundColor: `#${label.color}20`,
                                            color: `#${label.color}`,
                                        }}
                                    >
                                        {label.name}
                                    </span>
                                ),
                            )}
                    </div>
                )}
            </div>
            <div className="shrink-0">
                {pr.user?.avatar_url && (
                    <img
                        src={pr.user.avatar_url}
                        alt={pr.user.login ?? ""}
                        className="size-5 rounded-full"
                    />
                )}
            </div>
        </div>
    );
}
