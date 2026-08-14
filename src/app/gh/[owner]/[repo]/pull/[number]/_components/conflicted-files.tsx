"use client";

import { AlertTriangle, Check, ChevronDown, Copy, FilePen } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PullsGetResponseData } from "~/server/github";
import { getFileIconName } from "~/utils/icons";

interface ConflictedFilesProps {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
    conflictedFiles: string[];
    compact?: boolean;
}

function CompactConflictedFiles({
    owner,
    repo,
    number,
    pullRequest,
    conflictedFiles,
}: ConflictedFilesProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [copiedFile, setCopiedFile] = useState<string | null>(null);

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (
            containerRef.current &&
            !containerRef.current.contains(e.target as Node)
        ) {
            setOpen(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            return () =>
                document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [open, handleClickOutside]);

    const hasResolve =
        pullRequest.head.repo?.full_name === pullRequest.base.repo?.full_name;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs"
                onClick={() => setOpen(!open)}
            >
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="font-medium text-text-label">
                    Conflicting files
                </span>
                <span className="text-text-muted">
                    ({conflictedFiles.length})
                </span>
                <ChevronDown
                    size={12}
                    className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-1 w-96 rounded-md border border-border bg-surface-elevated p-2 shadow-lg">
                    <ul className="space-y-0.5">
                        {conflictedFiles.map((file) => {
                            const isCopied = copiedFile === file;
                            return (
                                <li
                                    key={file}
                                    className="group flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-text-secondary text-xs"
                                >
                                    <FileIcon file={file} />
                                    <span className="break-all">{file}</span>
                                    <button
                                        type="button"
                                        className="ml-auto shrink-0 cursor-pointer rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-text-label group-hover:opacity-100"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(
                                                file,
                                            );
                                            setCopiedFile(file);
                                            setTimeout(
                                                () => setCopiedFile(null),
                                                1500,
                                            );
                                        }}
                                    >
                                        {isCopied ? (
                                            <Check size={13} />
                                        ) : (
                                            <Copy size={13} />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {hasResolve && (
                        <a
                            href={`https://github.com/${owner}/${repo}/pull/${number}/conflicts`}
                            className="mt-1.5 flex cursor-pointer items-center justify-center gap-1.5 rounded border-border border-t pt-1.5 font-medium text-text-label text-xs transition-colors hover:text-text-primary"
                        >
                            <FilePen size={12} />
                            Resolve conflicts
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function FileIcon({ file }: { file: string }) {
    return (
        <Image
            alt=""
            className="h-3.5 w-3.5 shrink-0"
            src={`/material-icons/${getFileIconName(file)}.svg`}
            width={14}
            height={14}
            onError={(e) => {
                (e.target as HTMLImageElement).src = "/material-icons/file.svg";
            }}
        />
    );
}

export function ConflictedFiles({
    owner,
    repo,
    number,
    pullRequest,
    conflictedFiles,
    compact,
}: ConflictedFilesProps) {
    if (compact) {
        return (
            <CompactConflictedFiles
                owner={owner}
                repo={repo}
                number={number}
                pullRequest={pullRequest}
                conflictedFiles={conflictedFiles}
            />
        );
    }

    const hasResolve =
        pullRequest.head.repo?.full_name === pullRequest.base.repo?.full_name;
    return (
        <div className="space-y-2 rounded-lg border border-border bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-sm text-text-label">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Conflicting files
                </span>
                {hasResolve && (
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
                        <FileIcon file={file} />
                        <span className="truncate">{file}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
