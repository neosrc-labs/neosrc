"use client";

import { File, FilePen } from "lucide-react";
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
        <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
            <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
                    Conflicting files
                </span>
            </div>
            <ul className="space-y-1">
                {conflictedFiles.map((file) => (
                    <li
                        key={file}
                        className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-yellow-700 dark:text-yellow-500"
                    >
                        <File size={12} className="shrink-0" />
                        <span className="truncate">{file}</span>
                    </li>
                ))}
            </ul>
            {pullRequest.head.repo?.full_name ===
                pullRequest.base.repo?.full_name && (
                <a
                    href={`https://github.com/${owner}/${repo}/pull/${number}/conflicts`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 font-medium text-xs text-yellow-800 transition-colors hover:bg-yellow-200 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                >
                    <FilePen size={12} />
                    Resolve
                </a>
            )}
        </div>
    );
}
