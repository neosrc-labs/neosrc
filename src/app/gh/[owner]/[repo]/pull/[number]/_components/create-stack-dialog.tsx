"use client";

import { useRouter } from "next/navigation";
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
import { StackList } from "./stack-list";

interface CreateStackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    owner: string;
    repo: string;
    suggestion: StackSuggestion;
}

export function CreateStackDialog({
    open,
    onOpenChange,
    owner,
    repo,
    suggestion,
}: CreateStackDialogProps) {
    const utils = api.useUtils();
    const router = useRouter();
    const createStackMutation = api.pulls.createStack.useMutation({
        onSuccess: () => {
            utils.pulls.getStack.invalidate();
            utils.pulls.list.invalidate();
            router.refresh();
            onOpenChange(false);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a stack</DialogTitle>
                    <DialogDescription>
                        Link these pull requests into a stack to review the
                        changes together. Each pull request targets the branch
                        of the pull request below it.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col">
                    <StackList
                        owner={owner}
                        repo={repo}
                        items={suggestion.pullRequests}
                        baseRef={suggestion.baseRef}
                        currentNumber={suggestion.pullRequests.at(-1)?.number}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
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
    );
}
