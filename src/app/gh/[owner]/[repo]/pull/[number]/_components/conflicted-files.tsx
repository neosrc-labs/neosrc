"use client";

import { AlertTriangle, File, FilePen } from "lucide-react";
import type { PullsGetResponseData } from "~/server/github";

interface ConflictedFilesProps {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
    conflictedFiles: string[];
}

export function ConflictedFiles({
    owner,
    repo,
    number,
    pullRequest,
    conflictedFiles,
}: ConflictedFilesProps) {
    return (
        <div className="space-y-2 rounded-lg border border-border bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-sm text-text-label">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Conflicting files
                </span>
                {pullRequest.head.repo?.full_name ===
                    pullRequest.base.repo?.full_name && (
                    <a
                        href={`https://github.com/${owner}/${repo}/pull/${number}/conflicts`}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-surface-tertiary"
                    >
                        <FilePen size={12} />
                        Resolve
                    </a>
                )}
            </div>
            <ul className="space-y-1">
                {conflictedFiles.map((file) => (
                    <li
                        key={file}
                        className="flex min-w-0 items-center gap-1.5 font-mono text-text-secondary text-xs"
                    >
                        <File size={12} className="shrink-0" />
                        <span className="truncate">{file}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
