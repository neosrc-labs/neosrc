import {
    CircleCheck,
    GitPullRequest,
    GitPullRequestDraft,
    MessageSquare,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CodebergIcon, GitHubIcon } from "~/components/icons";
import { ListSkeleton } from "~/components/list/list-skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ViewerItemProvider } from "~/server/api/routers/dashboard/types";
import { formatRelativeTime } from "~/utils/format-time";
import { cn } from "~/utils/helpers";
import { providerLabel } from "~/utils/provider-url";

/** The fields a home row needs; both viewer item shapes satisfy it. */
export interface ViewerItemRowData {
    provider: ViewerItemProvider;
    repo: string;
    number: number;
    title: string;
    isDraft?: boolean;
    updatedAt: string;
    comments: number;
}

export type ViewerItemKind = "pull" | "issue";

interface StatusDisplay {
    Icon: typeof GitPullRequest;
    color: string;
    label: string;
}

/** The lists only carry open items, so draft is the only other look. */
function statusDisplay(kind: ViewerItemKind, isDraft: boolean): StatusDisplay {
    if (kind === "issue") {
        return { Icon: CircleCheck, color: "text-state-open", label: "Open" };
    }
    if (isDraft) {
        return {
            Icon: GitPullRequestDraft,
            color: "text-state-draft",
            label: "Draft",
        };
    }
    return { Icon: GitPullRequest, color: "text-state-open", label: "Open" };
}

function ProviderIcon({ provider }: { provider: ViewerItemProvider }) {
    return provider === "gh" ? (
        <GitHubIcon className="size-4" />
    ) : (
        <CodebergIcon className="size-4" />
    );
}

export function RecentItemRow({
    kind,
    item,
}: {
    kind: ViewerItemKind;
    item: ViewerItemRowData;
}) {
    const { Icon, color, label } = statusDisplay(kind, item.isDraft === true);
    const href = `/${item.provider}/${item.repo}/${kind === "pull" ? "pull" : "issues"}/${item.number}`;

    return (
        <div className="flex items-start gap-3 border-border-subtle border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>

            <div className="min-w-0 flex-1">
                <Link
                    href={href}
                    className="break-words font-medium text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                >
                    {item.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
                    <Link
                        href={`/${item.provider}/${item.repo}`}
                        className="text-text-tertiary hover:underline"
                    >
                        {item.repo}
                    </Link>
                    <span className="text-text-tertiary">#{item.number}</span>
                    <span>
                        updated{" "}
                        <span title={new Date(item.updatedAt).toLocaleString()}>
                            {formatRelativeTime(item.updatedAt)}
                        </span>
                    </span>
                    {item.comments > 0 && (
                        <span className="flex items-center gap-1 text-text-tertiary">
                            <MessageSquare className="size-3.5" />
                            {item.comments}
                        </span>
                    )}
                </div>
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="mt-0.5 shrink-0 text-text-tertiary"
                        aria-label={providerLabel(item.provider)}
                    >
                        <ProviderIcon provider={item.provider} />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                    {providerLabel(item.provider)}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

function UnavailableNotice({ providers }: { providers: ViewerItemProvider[] }) {
    const names = providers.map(providerLabel).join(", ");
    return (
        <p className="border-border-subtle border-t px-4 py-2 text-text-tertiary text-xs">
            {names} could not be loaded.
        </p>
    );
}

export function RecentItemsSection({
    title,
    kind,
    emptyLabel,
    items,
    isLoading,
    unavailable,
}: {
    title: string;
    kind: ViewerItemKind;
    emptyLabel: ReactNode;
    items: ViewerItemRowData[];
    isLoading: boolean;
    unavailable: ViewerItemProvider[];
}) {
    return (
        <section className="rounded-xl border border-border">
            <h2 className="border-border-subtle border-b px-4 py-3 font-semibold text-sm text-text-primary">
                {title}
            </h2>
            {isLoading ? (
                <ListSkeleton />
            ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-text-tertiary">
                    {emptyLabel}
                </p>
            ) : (
                <div>
                    {items.map((item) => (
                        <RecentItemRow
                            key={`${item.provider}:${item.repo}#${item.number}`}
                            kind={kind}
                            item={item}
                        />
                    ))}
                </div>
            )}
            {unavailable.length > 0 && (
                <UnavailableNotice providers={unavailable} />
            )}
        </section>
    );
}
