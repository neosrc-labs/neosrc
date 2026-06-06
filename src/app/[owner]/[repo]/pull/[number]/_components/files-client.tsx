"use client";

import { MessageSquare, MessageSquareOff } from "lucide-react";
import type { ReactNode } from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Async } from "~/components/async";
import { SCROLL_TARGET_EVENT } from "~/components/LazyRenderItem";
import type { PullsGetResponseData, ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

export interface FilesContextValue {
    allCommentsAll: ReviewComment[];
    pendingReviewId: number | null;
    showComments: boolean;
    expandedGeneratedFiles: Set<string>;
    expandedOverflowFiles: Set<string>;
    toggleGeneratedFile: (filename: string) => void;
    toggleOverflowFile: (filename: string) => void;
    pullRequestPromise: Promise<PullsGetResponseData>;
    commitSha?: string;
    heightMapRef: React.MutableRefObject<Map<string, number>>;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export function useFilesContext(): FilesContextValue {
    const ctx = useContext(FilesContext);
    if (!ctx)
        throw new Error("useFilesContext must be used within FilesSection");
    return ctx;
}

interface FilesSectionProps {
    owner: string;
    repo: string;
    number: number;
    commitSha?: string;
    pullRequestPromise: Promise<PullsGetResponseData>;
    children: ReactNode;
}

export function FilesSection({
    owner,
    repo,
    number,
    commitSha,
    pullRequestPromise,
    children,
}: FilesSectionProps) {
    const [showComments, setShowComments] = useState(true);
    const [expandedGeneratedFiles, setExpandedGeneratedFiles] = useState(
        () => new Set<string>(),
    );
    const [expandedOverflowFiles, setExpandedOverflowFiles] = useState(
        () => new Set<string>(),
    );
    const heightMapRef = useRef(new Map<string, number>());

    const { data: allComments = [] } = api.reviewComments.list.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const allCommentsAll = useMemo((): ReviewComment[] => {
        const submitted = allComments;
        const pending = (pendingReview?.comments ?? []) as ReviewComment[];
        return [...submitted, ...pending];
    }, [allComments, pendingReview]);

    const pendingReviewId = pendingReview?.reviewId ?? null;

    const toggleGeneratedFile = useCallback((filename: string) => {
        setExpandedGeneratedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    }, []);

    const toggleOverflowFile = useCallback((filename: string) => {
        setExpandedOverflowFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (allCommentsAll.length === 0) return;
        const hash = window.location.hash;
        if (hash.startsWith("#review-thread-")) {
            const id = hash.slice(1);
            window.dispatchEvent(
                new CustomEvent(SCROLL_TARGET_EVENT, { detail: id }),
            );
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [allCommentsAll]);

    useEffect(() => {
        const hash = window.location.hash;
        if (!hash || hash.startsWith("#review-thread-")) return;

        const id = hash.slice(1);

        const scrollToTarget = () => {
            window.dispatchEvent(
                new CustomEvent(SCROLL_TARGET_EVENT, { detail: id }),
            );
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                return true;
            }
            return false;
        };

        if (scrollToTarget()) return;

        const observer = new MutationObserver(() => {
            if (scrollToTarget()) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const timeout = setTimeout(() => observer.disconnect(), 15000);
        return () => {
            observer.disconnect();
            clearTimeout(timeout);
        };
    }, []);

    const contextValue = useMemo<FilesContextValue>(
        () => ({
            allCommentsAll,
            pendingReviewId,
            showComments,
            expandedGeneratedFiles,
            expandedOverflowFiles,
            toggleGeneratedFile,
            toggleOverflowFile,
            pullRequestPromise,
            commitSha,
            heightMapRef,
        }),
        [
            allCommentsAll,
            pendingReviewId,
            showComments,
            expandedGeneratedFiles,
            expandedOverflowFiles,
            toggleGeneratedFile,
            toggleOverflowFile,
            pullRequestPromise,
            commitSha,
        ],
    );

    return (
        <FilesContext.Provider value={contextValue}>
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <Async
                        promise={pullRequestPromise}
                        fallback={
                            <h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                                Files Changed
                            </h2>
                        }
                    >
                        {(pr) => (
                            <h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                                Files Changed ({pr.changed_files ?? 0})
                            </h2>
                        )}
                    </Async>
                    <div className="flex items-center gap-2">
                        <button
                            className="cursor-pointer rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
                            onClick={() => setShowComments(!showComments)}
                            title={
                                showComments ? "Hide comments" : "Show comments"
                            }
                            type="button"
                        >
                            {showComments ? (
                                <MessageSquare size={16} />
                            ) : (
                                <MessageSquareOff size={16} />
                            )}
                        </button>
                    </div>
                </div>
                {children}
            </div>
        </FilesContext.Provider>
    );
}
