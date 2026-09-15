"use client";

import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import type { BranchListConfig } from "./branch-list-config";

export function DeleteBranchDialog({
    owner,
    repo,
    branch,
    config,
    onClose,
}: {
    owner: string;
    repo: string;
    branch: string;
    config: BranchListConfig;
    onClose: () => void;
}) {
    const utils = api.useUtils();
    const mutation = api.branches.deleteBranch.useMutation({
        onSuccess: () => {
            onClose();
        },
        onSettled: () => {
            void utils.branches.list.invalidate();
            void utils.repos.getBranches.invalidate();
            void utils.repos.getRefCounts.invalidate();
        },
    });

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete branch '{branch}'?</DialogTitle>
                    <DialogDescription>
                        This branch cannot be restored.
                    </DialogDescription>
                </DialogHeader>
                {mutation.error && (
                    <p className="text-red-600 text-sm">
                        {mutation.error.message}
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={mutation.isPending}
                        onClick={() =>
                            mutation.mutate({
                                provider: config.provider,
                                owner,
                                repo,
                                branch,
                            })
                        }
                    >
                        Delete branch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
