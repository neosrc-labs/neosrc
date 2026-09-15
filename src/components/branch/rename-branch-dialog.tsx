"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import type { BranchListConfig } from "./branch-list-config";

export function RenameBranchDialog({
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
    const [newName, setNewName] = useState(branch);
    const mutation = api.branches.renameBranch.useMutation({
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
                    <DialogTitle>Rename branch '{branch}'</DialogTitle>
                </DialogHeader>
                <input
                    aria-label="New branch name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
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
                        disabled={newName.trim() === "" || mutation.isPending}
                        onClick={() =>
                            mutation.mutate({
                                provider: config.provider,
                                owner,
                                repo,
                                branch,
                                newName: newName.trim(),
                            })
                        }
                    >
                        Rename branch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
