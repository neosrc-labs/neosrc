"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { api } from "~/trpc/react";

interface RepoDocFilesProps {
    owner: string;
    repo: string;
    ref: string;
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

export function RepoDocFiles({ owner, repo, ref }: RepoDocFilesProps) {
    const { data: docFiles, isLoading } = api.repos.getDocFiles.useQuery({
        owner,
        repo,
        ref,
    });

    const [activeTab, setActiveTab] = useState<string | null>(null);

    useEffect(() => {
        if (!docFiles || docFiles.length === 0) return;

        const handleHash = () => {
            const hash = window.location.hash.slice(1);
            if (hash) {
                const match = docFiles.find(
                    (f) => getDocFileHashName(f.name) === hash,
                );
                if (match) {
                    setActiveTab(match.name);
                    const el = document.getElementById("doc-files");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    return true;
                }
            }
            return false;
        };

        if (!handleHash() && !activeTab) {
            setActiveTab(docFiles[0]?.name ?? null);
        }

        window.addEventListener("hashchange", handleHash);
        return () => window.removeEventListener("hashchange", handleHash);
    }, [docFiles, activeTab]);

    const activeFile = useMemo(() => {
        if (!docFiles || docFiles.length === 0) return null;
        if (activeTab && docFiles.some((f) => f.name === activeTab)) {
            return docFiles.find((f) => f.name === activeTab) ?? null;
        }
        return docFiles[0] ?? null;
    }, [docFiles, activeTab]);

    if (isLoading) {
        return (
            <div className="mt-6 rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 h-4 w-24 animate-pulse rounded bg-surface-secondary" />
                <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-surface-secondary" />
                </div>
            </div>
        );
    }

    if (!docFiles || docFiles.length === 0) {
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

    return (
        <div
            id="doc-files"
            className="mt-6 rounded-xl border border-border bg-surface"
        >
            <div className="border-border border-b">
                <div className="flex items-center px-2 py-1">
                    {docFiles.map((file) => (
                        <button
                            key={file.name}
                            type="button"
                            onClick={() => setActiveTab(file.name)}
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
            <div className="p-6">
                {activeFile &&
                    (activeFile.name.endsWith(".md") ? (
                        <MarkdownRenderer
                            content={activeFile.content}
                            owner={owner}
                            repo={repo}
                            canToggleTasks={false}
                        />
                    ) : (
                        <pre className="whitespace-pre-wrap text-sm">
                            {activeFile.content}
                        </pre>
                    ))}
            </div>
        </div>
    );
}
