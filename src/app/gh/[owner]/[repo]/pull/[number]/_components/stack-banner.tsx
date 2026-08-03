"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import type { StackSuggestion } from "~/server/github";
import { api } from "~/trpc/react";

interface StackBannerProps {
    owner: string;
    repo: string;
    suggestion: StackSuggestion;
}

export function StackBanner({ owner, repo, suggestion }: StackBannerProps) {
    const utils = api.useUtils();
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const createStackMutation = api.pulls.createStack.useMutation({
        onSuccess: () => {
            utils.pulls.getStack.invalidate();
            utils.pulls.list.invalidate();
            router.refresh();
            setDialogOpen(false);
        },
    });

    const count = suggestion.pullRequests.length;
    const [bottom] = suggestion.pullRequests;
    const label =
        count === 2
            ? `Stack this pull request on #${bottom?.number}?`
            : `Stack these ${count} pull requests?`;

    return (
        <>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-500/20 dark:bg-blue-500/10">
                <div className="flex min-w-0 items-center gap-2.5">
                    <Layers className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <p className="truncate font-medium text-sm text-text-primary">
                        {label}
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialogOpen(true)}
                >
                    Create stack
                </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a stack</DialogTitle>
                        <DialogDescription>
                            Link these pull requests into a stack to review the
                            changes together. Each pull request targets the
                            branch of the pull request below it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1">
                        {suggestion.pullRequests
                            .slice()
                            .reverse()
                            .map((pr, index) => (
                                <Link
                                    key={pr.number}
                                    href={`/gh/${owner}/${repo}/pull/${pr.number}`}
                                    className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-surface-selected"
                                >
                                    <span className="w-4 shrink-0 text-right font-mono text-text-tertiary text-xs">
                                        {index + 1}
                                    </span>
                                    <span className="truncate font-medium text-text-primary">
                                        {pr.title}
                                    </span>
                                    <span className="ml-auto shrink-0 font-mono text-text-secondary text-xs">
                                        #{pr.number}
                                    </span>
                                </Link>
                            ))}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={createStackMutation.isPending}
                            onClick={() =>
                                createStackMutation.mutate({
                                    owner,
                                    repo,
                                    pullRequests: suggestion.pullRequests.map(
                                        (pr) => pr.number,
                                    ),
                                })
                            }
                        >
                            Create stack
                        </Button>
                    </DialogFooter>
                    {createStackMutation.isError && (
                        <p className="text-red-600 text-xs">
                            Failed to create the stack. Please try again.
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
