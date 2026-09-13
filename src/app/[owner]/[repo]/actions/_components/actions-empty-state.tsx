"use client";

import { CirclePlay } from "lucide-react";

export function ActionsEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <CirclePlay className="size-8 text-text-muted" />
            <p className="mt-3 font-medium text-sm text-text-primary">
                {filtered
                    ? "No workflow runs matched the current filters"
                    : "There are no workflow runs yet"}
            </p>
            {!filtered && (
                <p className="mt-1 text-sm text-text-muted">
                    Workflow runs will appear here once this repository runs a
                    workflow.
                </p>
            )}
        </div>
    );
}
