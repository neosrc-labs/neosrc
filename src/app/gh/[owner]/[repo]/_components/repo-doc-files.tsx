"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { api } from "~/trpc/react";

interface RepoDocFilesProps {
    owner: string;
    repo: string;
    ref: string;
    fileNames?: { name: string; path: string }[];
}

function getDisplayName(name: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    const lowerBase = base.toLowerCase();

    if (/^readme/i.test(name)) return "README";
    if (/^contributing/i.test(name)) return "Contributing";
    if (/^code_of_conduct/i.test(name)) return "Code of Conduct";

    if (/mit/i.test(lowerBase)) return "MIT License";
    if (/apache/i.test(lowerBase)) return "Apache-2.0 License";
    if (/gpl/i.test(lowerBase)) return "GPL License";
    if (/bsd/i.test(lowerBase)) return "BSD License";
    if (/mpl/i.test(lowerBase)) return "MPL License";

    return base;
}

function getDocFileHashName(name: string): string {
    if (/^readme/i.test(name)) return "readme";
    if (/^contributing/i.test(name)) return "contributing";
    if (/^code_of_conduct/i.test(name)) return "code-of-conduct";
    if (/^(licen[cs]e|copying)/i.test(name)) return "license";
    return name.toLowerCase().replace(/\.[^.]+$/, "");
}

export function RepoDocFiles({
    owner,
    repo,
    ref,
    fileNames = [],
}: RepoDocFilesProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<Record<string, string>>(
        {},
    );
    const [loadingPath, setLoadingPath] = useState<string | null>(null);
    const fileContentsRef = useRef(fileContents);
    fileContentsRef.current = fileContents;
    const initRef = useRef(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const trpcUtils = api.useUtils();

    const loadContent = useCallback(
        async (path: string) => {
            if (fileContentsRef.current[path] !== undefined) return;
            setLoadingPath(path);
            try {
                const data = await trpcUtils.repos.getDocFileContent.fetch({
                    owner,
                    repo,
                    ref,
                    path,
                });
                setFileContents((prev) => ({
                    ...prev,
                    [path]: data.content,
                }));
            } catch {
                // file not found or API error
            } finally {
                setLoadingPath(null);
            }
        },
        [owner, repo, ref, trpcUtils],
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

        const hash = window.location.hash.slice(1);
        const el = hash
            ? document.getElementById(hash)
            : document.getElementById("doc-files");
        if (el) el.scrollIntoView();
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
        return (
            <div
                id="doc-files"
                className="mt-6 rounded-xl border border-border bg-surface"
            >
                <div className="px-6 py-8 text-center text-sm text-text-tertiary">
                    No documentation found.
                </div>
            </div>
        );
    }

    const currentContent = activeFile
        ? fileContents[activeFile.path]
        : undefined;

    return (
        <div
            id="doc-files"
            className="mt-6 rounded-xl border border-border bg-surface"
        >
            <div className="border-border border-b">
                <div className="flex items-center px-2 py-1">
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
                            {getDisplayName(file.name)}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={contentRef} className="p-6">
                {loadingPath !== null ? (
                    <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-surface-secondary" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-secondary" />
                    </div>
                ) : currentContent != null ? (
                    activeFile?.name.endsWith(".md") ? (
                        <MarkdownRenderer
                            content={currentContent}
                            owner={owner}
                            repo={repo}
                            canToggleTasks={false}
                            linkableHeadings
                        />
                    ) : (
                        <pre className="whitespace-pre-wrap text-sm">
                            {currentContent}
                        </pre>
                    )
                ) : null}
            </div>
        </div>
    );
}
