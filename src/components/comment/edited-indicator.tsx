"use client";

import { createTwoFilesPatch } from "diff";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { DiffView } from "~/components/diff/diff-view";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import { disabled } from "~/components/permissions/permissions-utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type {
    EditHistoryEntry,
    EditSummary,
    GQLIssueComment,
    GQLPullRequestReview,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";

/** Last-edit summary from the `userContentEdits(first: 1)` projection on
 *  IssueComment / PullRequestReview timeline nodes. */
export function getCommentLastEdit(
    event: GQLIssueComment | GQLPullRequestReview,
): EditSummary {
    const node = event.edits?.nodes?.find((n) => n !== null);
    if (!node) return null;
    return { editedAt: node.editedAt, editor: node.editor };
}

interface EditedIndicatorProps {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    subject: "issue" | "pull";
    /** Already-resolved last edit; null-ish renders nothing. */
    summary: EditSummary;
    /** GraphQL node id of a comment/review body; enables the dropdown. */
    commentNodeId?: string;
    /** Set for description cards to fetch body edits. */
    bodyHistory?: boolean;
}

export function EditedIndicator({
    provider,
    owner,
    repo,
    number,
    subject,
    summary,
    commentNodeId,
    bodyHistory = false,
}: EditedIndicatorProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [selected, setSelected] = useState<{
        entry: EditHistoryEntry;
        /** Content before this edit; null when no earlier version is exposed. */
        before: string | null;
    } | null>(null);

    if (!summary) return null;

    // Forgejo exposes no edit history; GitHub bodies without a node id also
    // degrade to a static marker with the full date on hover.
    if (provider === "cb" || (!commentNodeId && !bodyHistory)) {
        return (
            <span
                className="whitespace-nowrap text-text-tertiary text-xs"
                title={formatDateTime(summary.editedAt)}
            >
                Edited {formatRelativeTime(summary.editedAt)}
            </span>
        );
    }

    return (
        <>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-text-tertiary text-xs hover:text-text-secondary"
                    >
                        Last edited by {summary.editor?.login ?? "unknown"}
                        <ChevronDown size={12} />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-surface p-1" align="end">
                    <EditHistoryMenu
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        number={number}
                        subject={subject}
                        commentNodeId={commentNodeId}
                        open={menuOpen}
                        onSelect={(entry, before) => {
                            setMenuOpen(false);
                            setSelected({ entry, before });
                        }}
                    />
                </PopoverContent>
            </Popover>
            <Dialog
                open={selected !== null}
                onOpenChange={(o) => {
                    if (!o) setSelected(null);
                }}
            >
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Edit history</DialogTitle>
                        <DialogDescription>
                            {selected?.entry.editor?.login ?? "unknown"}
                            {selected
                                ? ` · ${formatRelativeTime(selected.entry.editedAt)}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <EditDiffView
                            after={selected.entry.diff}
                            before={selected.before}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function EditHistoryMenu({
    provider,
    owner,
    repo,
    number,
    subject,
    commentNodeId,
    open,
    onSelect,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    subject: "issue" | "pull";
    commentNodeId?: string;
    open: boolean;
    onSelect: (entry: EditHistoryEntry, before: string | null) => void;
}) {
    const query = api.issues.editHistory.useQuery(
        {
            provider,
            owner,
            repo,
            number,
            subject,
            commentNodeId,
        },
        { enabled: open, staleTime: 60_000 },
    );

    if (query.isPending) {
        return (
            <div className="flex flex-col gap-1.5 p-1">
                <div className="h-5 w-56 animate-pulse rounded bg-surface-selected" />
                <div className="h-5 w-44 animate-pulse rounded bg-surface-selected" />
            </div>
        );
    }

    const entries = query.data ?? [];
    if (entries.length === 0) {
        return (
            <p className="px-2 py-1.5 text-sm text-text-tertiary">
                No edit history available
            </p>
        );
    }

    return (
        <div className="flex flex-col">
            {entries.map((entry, index) => (
                <button
                    key={entry.editedAt}
                    type="button"
                    disabled={entry.diff === null}
                    title={
                        entry.diff === null ? "No diff available" : undefined
                    }
                    // Entries are newest-first and each diff is the content at
                    // that edit, so the previous version is the next entry's
                    // diff; the oldest edit has no exposed earlier version.
                    onClick={() =>
                        onSelect(entry, entries[index + 1]?.diff ?? null)
                    }
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        {entry.editor ? (
                            <Image
                                alt={entry.editor.login}
                                className="h-4 w-4 shrink-0 rounded-full"
                                height={16}
                                src={entry.editor.avatarUrl}
                                width={16}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 rounded-full bg-surface-tertiary"
                            />
                        )}
                        <span className="truncate">
                            {entry.editor?.login ?? "unknown"}
                        </span>
                    </span>
                    <span className="whitespace-nowrap text-text-tertiary text-xs">
                        {formatRelativeTime(entry.editedAt)}
                    </span>
                </button>
            ))}
        </div>
    );
}

// DiffView needs a permission context even with comments disabled; the
// disabled context keeps every interaction off.
function EditDiffView({
    before,
    after,
}: {
    before: string | null;
    after: string | null;
}) {
    const patch = useMemo(() => {
        if (before === null || after === null) return null;
        // jsdiff prefixes a "===" separator line; drop it so the patch starts
        // with "---" and DiffView's normalizeDiffPatch leaves it intact.
        return createTwoFilesPatch(
            "a/comment.md",
            "b/comment.md",
            before,
            after,
            undefined,
            undefined,
            { context: 3 },
        ).replace(/^=+\n/, "");
    }, [before, after]);

    // The oldest edit has no earlier version to diff against; GitHub's edit
    // API only exposes the post-edit snapshot, so show it as markdown.
    if (patch === null) {
        return after === null ? null : (
            <div className="max-h-[70vh] overflow-auto">
                <MarkdownRenderer content={after} />
            </div>
        );
    }

    return (
        <div className="max-h-[70vh] overflow-auto">
            <DiffView
                patch={patch}
                filename="comment.md"
                permissionContext={disabled()}
                view="unified"
                idleParse={false}
            />
        </div>
    );
}
