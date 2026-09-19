"use client";

import {
    Check,
    Copy,
    GitPullRequest,
    MoreHorizontal,
    Shield,
    Trash2,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusChecksHoverCard } from "~/components/ci-status";
import { CopyButton } from "~/components/ui/copy-button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { UserLink } from "~/components/user/user-link";
import type { BranchRow } from "~/server/api/routers/branches/types";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import {
    compareUrl,
    domain,
    type Provider,
    treeHref,
} from "~/utils/provider-url";
import type { BranchListConfig } from "./branch-list-config";
import { DeleteBranchDialog } from "./delete-branch-dialog";
import { RenameBranchDialog } from "./rename-branch-dialog";

const PASSING_STATES = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

/** One branch row: name, head commit, checks, pull request and its actions. */
export function BranchTableRow({
    provider,
    owner,
    repo,
    branch,
    canManage,
    isAdmin,
    defaultBranch,
    config,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    branch: BranchRow;
    canManage: boolean;
    isAdmin: boolean;
    defaultBranch: string | null;
    config: BranchListConfig;
}) {
    const [dialog, setDialog] = useState<"delete" | "rename" | null>(null);
    const host = domain(provider);
    const isDefault = branch.name === defaultBranch;
    const passed = branch.checks.filter((check) =>
        PASSING_STATES.has(check.state),
    ).length;
    const rulesUrl = config.rulesUrl(owner, repo, branch.name);

    return (
        <>
            <tr className="h-10 border-border-subtle border-b hover:bg-surface-secondary">
                <td className="px-4 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Link
                            href={treeHref(provider, owner, repo, {
                                kind: "branch",
                                value: branch.name,
                            })}
                            prefetch={false}
                            title={branch.name}
                            className="min-w-0 truncate font-mono text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            {branch.name}
                        </Link>
                        <CopyButton
                            text={branch.name}
                            title="Copy branch name"
                            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-text-muted hover:text-text-secondary dark:hover:text-zinc-300"
                        >
                            {(copied) =>
                                copied ? (
                                    <Check className="size-3.5" />
                                ) : (
                                    <Copy className="size-3.5" />
                                )
                            }
                        </CopyButton>
                        {branch.isProtected && (
                            <a
                                href={rulesUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Protected branch"
                                className="flex shrink-0 items-center text-text-tertiary hover:text-text-secondary"
                            >
                                <Shield className="size-3.5" />
                            </a>
                        )}
                    </div>
                </td>

                <td className="px-4 py-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
                        {branch.author?.login && branch.author.avatarUrl ? (
                            <UserLink
                                provider={provider}
                                showUsername={false}
                                actor={{
                                    login: branch.author.login,
                                    avatarUrl: branch.author.avatarUrl,
                                    url: `https://${host}/${branch.author.login}`,
                                }}
                            />
                        ) : (
                            <>
                                <UserRound className="size-4 shrink-0 text-text-tertiary" />
                                <span className="truncate">
                                    {branch.author?.name}
                                </span>
                            </>
                        )}
                        {branch.updatedAt === "" ? (
                            <span className="text-text-tertiary">—</span>
                        ) : (
                            <a
                                href={`https://${host}/${owner}/${repo}/commit/${branch.sha}`}
                                title={formatDateTime(branch.updatedAt)}
                                className="shrink-0 whitespace-nowrap text-text-tertiary hover:text-text-secondary"
                            >
                                {formatRelativeTime(branch.updatedAt)}
                            </a>
                        )}
                    </div>
                </td>

                <td className="px-4 py-2">
                    {branch.checks.length === 0 ? (
                        <span className="text-text-tertiary">—</span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <StatusChecksHoverCard
                                contexts={branch.checks}
                                className="size-4"
                            />
                            <span className="text-text-secondary text-xs tabular-nums">
                                {passed} / {branch.checks.length}
                            </span>
                        </div>
                    )}
                </td>

                <td className="px-4 py-2">
                    {branch.pullRequestNumber !== null && (
                        <Link
                            href={`/${provider}/${owner}/${repo}/pull/${branch.pullRequestNumber}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            <GitPullRequest className="size-4" />#
                            {branch.pullRequestNumber}
                        </Link>
                    )}
                </td>

                <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                        {canManage && !isDefault && (
                            <button
                                type="button"
                                aria-label={`Delete branch ${branch.name}`}
                                onClick={() => setDialog("delete")}
                                className="flex size-6 cursor-pointer items-center justify-center rounded text-text-muted hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        )}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`Branch actions for ${branch.name}`}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded text-text-muted hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                                >
                                    <MoreHorizontal className="size-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <a
                                        href={compareUrl(
                                            provider,
                                            owner,
                                            repo,
                                            branch.name,
                                            defaultBranch,
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Compare
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a
                                        href={`https://${host}/${owner}/${repo}/activity?ref=${encodeURIComponent(branch.name)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Activity
                                    </a>
                                </DropdownMenuItem>
                                {(config.rulesForEveryone || isAdmin) && (
                                    <DropdownMenuItem asChild>
                                        <a
                                            href={rulesUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {config.rulesLabel}
                                        </a>
                                    </DropdownMenuItem>
                                )}
                                {canManage && !isDefault && (
                                    <>
                                        <DropdownMenuItem
                                            onSelect={() => setDialog("rename")}
                                        >
                                            Rename branch…
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() => setDialog("delete")}
                                        >
                                            Delete branch
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </td>
            </tr>
            {dialog === "delete" && (
                <DeleteBranchDialog
                    owner={owner}
                    repo={repo}
                    branch={branch.name}
                    config={config}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === "rename" && (
                <RenameBranchDialog
                    owner={owner}
                    repo={repo}
                    branch={branch.name}
                    config={config}
                    onClose={() => setDialog(null)}
                />
            )}
        </>
    );
}
