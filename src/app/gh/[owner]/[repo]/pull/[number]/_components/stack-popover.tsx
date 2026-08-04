"use client";

import { Layers, LayersMinus } from "lucide-react";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { StackList } from "./stack-list";

interface StackPopoverProps {
    owner: string;
    repo: string;
    prNumber: number;
    onClose: () => void;
}

function StackPopoverContent({
    owner,
    repo,
    prNumber,
    onClose,
}: StackPopoverProps) {
    const utils = api.useUtils();
    const router = useRouter();
    const { data, isLoading } = api.pulls.getStack.useQuery(
        { owner, repo, prNumber },
        { enabled: true },
    );
    const unstackMutation = api.pulls.unstack.useMutation({
        onSuccess: () => {
            utils.pulls.getStack.invalidate({ owner, repo, prNumber });
            utils.pulls.list.invalidate();
            router.refresh();
            onClose();
        },
    });
    const [confirmUnstack, setConfirmUnstack] = useState(false);
    if (isLoading) {
        return (
            <div className="flex min-w-[360px] flex-col gap-3 px-4 py-3">
                <div className="h-7 w-24 animate-pulse rounded bg-surface-selected" />
                {["skel-1", "skel-2", "skel-3"].map((key) => (
                    <div
                        key={key}
                        className="h-5 w-3/4 animate-pulse rounded bg-surface-selected"
                    />
                ))}
                <div className="h-5 w-16 animate-pulse rounded bg-surface-selected" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-2 text-text-secondary text-xs">
                Failed to load stack
            </div>
        );
    }
    return (
        <div className="flex min-w-[360px] flex-col">
            <div className="flex items-center justify-between border-border border-b px-4 py-3">
                <span className="font-bold font-semibold text-lg">
                    Stack #{data.number}
                </span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            aria-label="Unstack pull requests"
                            className="flex size-6 cursor-pointer items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-selected hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={unstackMutation.isPending}
                            onClick={() => setConfirmUnstack(true)}
                        >
                            <LayersMinus className="size-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Unstack pull requests
                    </TooltipContent>
                </Tooltip>
            </div>
            <StackList
                owner={owner}
                repo={repo}
                items={data.pullRequests}
                baseRef={data.baseRef}
                currentNumber={prNumber}
            />
            <Dialog open={confirmUnstack} onOpenChange={setConfirmUnstack}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Unstack pull requests</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to unstack these pull
                            requests?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmUnstack(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={unstackMutation.isPending}
                            onClick={() =>
                                unstackMutation.mutate({
                                    owner,
                                    repo,
                                    stackNumber: data.number,
                                    prNumbers: data.pullRequests.map(
                                        (pr) => pr.number,
                                    ),
                                })
                            }
                        >
                            Unstack
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function StackBadge({
    owner,
    repo,
    stack,
    prNumber,
}: {
    owner: string;
    repo: string;
    stack: { size: number; position: number; number: number };
    prNumber: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-text-secondary text-xs transition-colors hover:bg-surface-selected hover:text-text",
                        open && "bg-surface-selected text-text",
                    )}
                >
                    <Layers className="size-3.5" />
                    {stack.position} / {stack.size}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto bg-surface p-0"
                align="start"
                side="bottom"
                sideOffset={6}
            >
                <StackPopoverContent
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                    onClose={() => setOpen(false)}
                />
            </PopoverContent>
        </Popover>
    );
}
