"use client";

import { BookOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import { getDocFileDisplayName, getDocFileHashName } from "~/lib/doc-files";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";

interface RepoDocFilesProps {
    owner: string;
    repo: string;
    ref: string;
    provider?: Provider;
    fileNames?: { name: string; path: string }[];
    /** Render nothing instead of the "add a README" card when empty. */
    hideEmpty?: boolean;
}

export function RepoDocFiles({
    owner,
    repo,
    ref,
    provider,
    fileNames = [],
    hideEmpty = false,
}: RepoDocFilesProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<
        Record<string, string | null>
    >({});
    const [loadingPath, setLoadingPath] = useState<string | null>(null);
    const fileContentsRef = useRef(fileContents);
    fileContentsRef.current = fileContents;
    const initRef = useRef(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const trpcUtils = api.useUtils();
    // Bumped on every load so a slower, superseded request can't clobber
    // state written by a newer one (e.g. rapid tab switching).
    const loadVersionRef = useRef(0);

    const loadContent = useCallback(
        async (path: string) => {
            if (fileContentsRef.current[path] !== undefined) return;
            const version = ++loadVersionRef.current;
            setLoadingPath(path);
            try {
                const data = await trpcUtils.repos.getFileContent.fetch({
                    owner,
                    repo,
                    ref,
                    path,
                    provider: provider ?? "gh",
                });
                if (version !== loadVersionRef.current) return;
                setFileContents((prev) => ({
                    ...prev,
                    [path]: data.content,
                }));
            } catch {
                // API error; a null content is cached as "nothing to show".
            } finally {
                if (version === loadVersionRef.current) setLoadingPath(null);
            }
        },
        [owner, repo, ref, provider, trpcUtils],
    );

    const activeFile = useMemo(() => {
        if (!activeTab || fileNames.length === 0) return null;
        return fileNames.find((f) => f.name === activeTab) ?? null;
    }, [activeTab, fileNames]);

    useEffect(() => {
        if (fileNames.length === 0 || initRef.current) return;
        initRef.current = true;

        const tabParam = searchParams.get("tab");
        let target = fileNames[0] ?? null;
        if (tabParam) {
            const match = fileNames.find(
                (f) => getDocFileHashName(f.name) === tabParam,
            );
            if (match) target = match;
        }

        if (target) setActiveTab(target.name);
    }, [fileNames, searchParams]);

    useEffect(() => {
        if (activeFile) loadContent(activeFile.path);
    }, [activeFile, loadContent]);

    const handleTabClick = useCallback(
        (file: { name: string; path: string }) => {
            const hashName = getDocFileHashName(file.name);
            setActiveTab(file.name);
            router.replace(`?tab=${hashName}`, { scroll: false });
            loadContent(file.path);
        },
        [router, loadContent],
    );

    if (fileNames.length === 0) {
        // Directories without a doc file show nothing, as on GitHub; the repo
        // root keeps the prompt to add a README.
        return hideEmpty ? null : <EmptyReadmeSection />;
    }

    const currentContent = activeFile
        ? fileContents[activeFile.path]
        : undefined;

    const docDir = activeFile?.path.includes("/")
        ? activeFile.path.slice(0, activeFile.path.lastIndexOf("/"))
        : "";
    const imageBaseUrl =
        (provider ?? "gh") === "cb"
            ? `https://codeberg.org/${owner}/${repo}/raw/branch/${ref}`
            : `https://raw.githubusercontent.com/${owner}/${repo}/${ref}`;

    return (
        <div
            id="doc-files"
            className="mt-6 rounded-xl border border-border bg-surface"
        >
            <div className="border-border border-b">
                <div className="flex h-9 items-center px-2 py-1">
                    {fileNames.map((file) => (
                        <button
                            key={file.name}
                            type="button"
                            onClick={() => handleTabClick(file)}
                            className={`relative -mb-px cursor-pointer px-3 py-1.5 font-medium text-xs transition-colors ${
                                activeTab === file.name
                                    ? "border-blue-500 border-b-2 text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            {getDocFileDisplayName(file.name)}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={contentRef}>
                {loadingPath !== null ? (
                    <DocContentSkeleton />
                ) : currentContent != null ? (
                    <div className="p-6">
                        {activeFile?.name.endsWith(".md") ? (
                            <MarkdownRenderer
                                content={currentContent}
                                owner={owner}
                                repo={repo}
                                canToggleTasks={false}
                                hardLineBreaks={false}
                                linkableHeadings
                                proseSize="base"
                                imageBaseUrl={imageBaseUrl}
                                imageDocDir={docDir}
                            />
                        ) : (
                            <pre className="whitespace-pre-wrap text-sm">
                                {currentContent}
                            </pre>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function RepoDocFilesSkeleton() {
    return (
        <div className="mt-6 rounded-xl border border-border bg-surface">
            <div className="h-9 border-border border-b px-2 py-1">
                <div className="flex h-full items-center gap-4">
                    <div className="h-5 w-16 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-5 w-20 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-5 w-18 animate-pulse rounded bg-surface-secondary" />
                </div>
            </div>
            <DocContentSkeleton />
        </div>
    );
}

function DocContentSkeleton() {
    return (
        <div className="space-y-2 p-6">
            <div className="mb-4 h-10 w-1/3 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-surface-secondary" />
        </div>
    );
}

function EmptyReadmeSection() {
    return (
        <div
            id="doc-files"
            className="mt-6 rounded-xl border border-border bg-surface"
        >
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <BookOpen className="size-8 text-text-muted" />
                <p className="font-medium text-base text-text-primary">
                    Add a README with an overview of your project.
                </p>
            </div>
        </div>
    );
}
