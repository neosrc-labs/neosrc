"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";

export function RevertButton({
    owner,
    repo,
    number,
    pullRequest,
}: {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
}) {
    const utils = api.useUtils();
    const router = useRouter();
    const [isRevertPopoverOpen, setIsRevertPopoverOpen] = useState(false);
    const revertTitleKey = `pr-autosave:revert-title:${owner}:${repo}:${number}`;
    const revertBodyKey = `pr-autosave:revert-body:${owner}:${repo}:${number}`;
    const [revertTitle, setRevertTitle] = useState(
        () => readAutosave(revertTitleKey) ?? "",
    );
    const [revertBody, setRevertBody] = useState(
        () => readAutosave(revertBodyKey) ?? "",
    );
    const [revertDraft, setRevertDraft] = useState(false);
    const { clear: clearRevertTitle } = useAutosave(
        revertTitleKey,
        revertTitle,
    );
    const { clear: clearRevertBody } = useAutosave(revertBodyKey, revertBody);

    const revertMutation = api.pulls.revert.useMutation({
        onSuccess: (data) => {
            clearRevertTitle();
            clearRevertBody();
            setIsRevertPopoverOpen(false);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.push(
                `/gh/${owner}/${repo}/pull/${data.revertPullRequest.number}`,
            );
        },
    });

    const openRevertDialog = useCallback(
        (pullRequest: PullsGetResponseData) => {
            setRevertTitle((prev) => prev || `Revert "${pullRequest.title}"`);
            setRevertBody(
                (prev) => prev || `Reverts ${owner}/${repo}#${number}`,
            );
            setRevertDraft(false);
            setIsRevertPopoverOpen(true);
        },
        [owner, repo, number],
    );

    const handleRevert = useCallback(() => {
        revertMutation.mutate({
            owner,
            repo,
            number,
            title: revertTitle || undefined,
            body: revertBody || undefined,
            draft: revertDraft || undefined,
        });
    }, [
        owner,
        repo,
        number,
        revertTitle,
        revertBody,
        revertDraft,
        revertMutation,
    ]);
    return (
        <Popover
            open={isRevertPopoverOpen}
            onOpenChange={setIsRevertPopoverOpen}
        >
            <PopoverTrigger asChild>
                <button
                    suppressHydrationWarning
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-1.5 py-2.5 text-text-secondary text-xs transition-colors hover:bg-surface-tertiary sm:px-3 dark:border-zinc-600"
                    disabled={revertMutation.isPending}
                    onClick={() => openRevertDialog(pullRequest)}
                    type="button"
                >
                    <Undo2 size={14} />
                    {revertMutation.isPending ? "Reverting..." : "Revert"}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-2xl bg-surface p-4"
                side="top"
                sideOffset={8}
            >
                <div className="mb-3 flex items-center gap-1.5">
                    <Undo2 size={14} className="text-text-label" />
                    <span className="font-medium text-sm text-text-primary">
                        Revert this pull request
                    </span>
                </div>
                <p className="mb-3 text-text-secondary text-xs">
                    A new pull request will be created that reverts the changes
                    from <span className="font-mono">#{number}</span>.
                </p>
                <label
                    className="mb-1 block font-medium text-text-label text-xs"
                    htmlFor="revert-title-input"
                >
                    Title
                </label>
                <input
                    className="mb-3 w-full rounded-md border border-gray-300 bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600"
                    disabled={revertMutation.isPending}
                    id="revert-title-input"
                    onChange={(e) => setRevertTitle(e.target.value)}
                    type="text"
                    value={revertTitle}
                />
                <label
                    className="mb-1 block font-medium text-text-label text-xs"
                    htmlFor="revert-body-input"
                >
                    Body
                </label>
                <MarkdownEditor
                    autoFocus
                    disabled={revertMutation.isPending}
                    minHeight="120px"
                    onChange={setRevertBody}
                    onCancel={() => setIsRevertPopoverOpen(false)}
                    owner={owner}
                    placeholder="Describe the revert"
                    repo={repo}
                    cancelLabel="Cancel"
                    value={revertBody}
                    footerActions={[
                        {
                            label: revertMutation.isPending
                                ? "Reverting..."
                                : "Revert",
                            onClick: () => handleRevert(),
                            variant: "neutral",
                            disabled: revertMutation.isPending,
                        },
                    ]}
                />
                <label className="mt-2 flex items-center gap-2 text-text-secondary text-xs">
                    <input
                        checked={revertDraft}
                        disabled={revertMutation.isPending}
                        onChange={(e) => setRevertDraft(e.target.checked)}
                        type="checkbox"
                    />
                    Create as draft
                </label>
            </PopoverContent>
        </Popover>
    );
}
