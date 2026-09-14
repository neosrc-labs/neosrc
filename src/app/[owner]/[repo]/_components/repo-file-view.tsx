"use client";

import { CopyIcon, DownloadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "~/components/ui/copy-button";
import { api } from "~/trpc/react";
import { highlightLines } from "~/utils/highlight";
import { type Provider, rawUrl, treeHref } from "~/utils/provider-url";
import { isFileEntry } from "./repo-contents";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";

interface RepoFileViewProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

export function RepoFileView({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoFileViewProps) {
    const router = useRouter();

    const { data: contents, error: contentsError } =
        api.repos.getContents.useQuery({
            provider,
            owner,
            repo,
            ref: selectedRef,
            path,
        });

    const { data: fileData } = api.repos.getFileContent.useQuery({
        provider,
        owner,
        repo,
        ref: selectedRef,
        path,
    });

    const isFile = isFileEntry(contents, path);
    const entry = isFile ? (contents?.[0] ?? null) : null;
    // Any other non-empty listing is the directory's children.
    const isDirectory =
        contents !== undefined && contents.length > 0 && !isFile;

    // A blob URL pointing at a directory lands on its tree page, as on GitHub.
    useEffect(() => {
        if (isDirectory) {
            router.replace(treeHref(provider, owner, repo, selectedRef, path));
        }
    }, [isDirectory, router, provider, owner, repo, selectedRef, path]);

    const pathMissing =
        contentsError !== null ||
        (contents !== undefined && contents.length === 0);

    if (pathMissing) {
        return (
            <RepoPathNotFound
                provider={provider}
                owner={owner}
                repo={repo}
                selectedRef={selectedRef}
            />
        );
    }

    const name = path.split("/").pop() ?? path;
    const raw = rawUrl(provider, owner, repo, selectedRef, path);
    const content = fileData?.content ?? null;

    return (
        <>
            <RepoPathCommitRow
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={selectedRef}
                path={path}
                view="blob"
                trailing={
                    entry?.type === "file" ? (
                        <span className="shrink-0 text-text-tertiary text-xs">
                            {formatFileSize(entry.size)}
                        </span>
                    ) : null
                }
            />

            <div className="flex min-h-10 items-center justify-between border-border border-b bg-surface-elevated px-4 py-1.5">
                <span className="text-text-tertiary text-xs">
                    {content === null
                        ? "Binary file"
                        : `${content.split("\n").length.toLocaleString()} lines`}
                </span>
                <div className="flex items-center gap-1">
                    {content !== null && (
                        <CopyButton
                            text={content}
                            title="Copy raw contents"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
                        >
                            {(copied) => (
                                <>
                                    <CopyIcon className="h-3.5 w-3.5" />
                                    {copied ? "Copied" : "Copy raw"}
                                </>
                            )}
                        </CopyButton>
                    )}
                    {content !== null && (
                        <DownloadButton name={name} content={content} />
                    )}
                    <a
                        href={raw}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
                    >
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Raw
                    </a>
                </div>
            </div>

            {fileData === undefined ? (
                <FileBodySkeleton />
            ) : content === null ? (
                <div className="px-6 py-12 text-center">
                    <p className="font-medium text-base text-text-primary">
                        This file is binary or too large to display.
                    </p>
                    <a
                        href={raw}
                        className="mt-2 inline-block text-blue-600 text-sm hover:underline dark:text-blue-400"
                    >
                        View raw
                    </a>
                </div>
            ) : (
                <CodeView name={name} content={content} />
            )}
        </>
    );
}

export function RepoFileViewSkeleton() {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex min-h-12 items-center gap-3 border-border border-b px-4 py-3">
                <div className="h-5 w-24 animate-pulse rounded bg-surface-secondary" />
                <div className="h-5 w-64 animate-pulse rounded bg-surface-secondary" />
            </div>
            <FileBodySkeleton />
        </div>
    );
}

function FileBodySkeleton() {
    return (
        <div className="space-y-2 p-6">
            {["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"].map(
                (key, index) => (
                    <div
                        key={key}
                        className="h-5 animate-pulse rounded bg-surface-secondary"
                        style={{ width: `${40 + ((index * 13) % 50)}%` }}
                    />
                ),
            )}
        </div>
    );
}

/**
 * Line-numbered file body. Highlighting runs in the browser so the grammar
 * chunk is not part of the page bundle; until it resolves the file shows as
 * plain text.
 */
function CodeView({ name, content }: { name: string; content: string }) {
    const [highlighted, setHighlighted] = useState<string | null>(null);

    const lineCount = useMemo(() => content.split("\n").length, [content]);

    useEffect(() => {
        let cancelled = false;
        setHighlighted(null);
        highlightLines(content, fileExtension(name)).then((lines) => {
            if (!cancelled && lines) setHighlighted(lines.join("\n"));
        });
        return () => {
            cancelled = true;
        };
    }, [content, name]);

    const lineNumbers = useMemo(
        () => Array.from({ length: lineCount }, (_, index) => index + 1),
        [lineCount],
    );

    return (
        <div className="flex overflow-x-auto font-mono text-xs leading-5">
            <div
                aria-hidden
                className="shrink-0 select-none border-border border-r bg-surface-elevated px-3 py-2 text-right text-text-muted"
            >
                {lineNumbers.map((line) => (
                    <div key={line}>{line}</div>
                ))}
            </div>
            {highlighted === null ? (
                <code className="min-w-0 flex-1 whitespace-pre px-3 py-2">
                    {content}
                </code>
            ) : (
                <code
                    className="min-w-0 flex-1 whitespace-pre px-3 py-2"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes the source before emitting token markup
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            )}
        </div>
    );
}

function DownloadButton({ name, content }: { name: string; content: string }) {
    const [href, setHref] = useState<string | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(new Blob([content]));
        setHref(url);
        return () => URL.revokeObjectURL(url);
    }, [content]);

    return (
        <a
            href={href ?? undefined}
            download={name}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
        >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download
        </a>
    );
}

/** Lowercased extension used as a highlight grammar tag; "" when there is none. */
function fileExtension(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
