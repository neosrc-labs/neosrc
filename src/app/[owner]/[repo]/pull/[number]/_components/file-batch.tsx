"use client";

import { use } from "react";
import FileDiff from "~/components/FileDiff";
import { LazyRenderItem } from "~/components/LazyRenderItem";
import type { PullRequestFile, ReviewComment } from "~/server/github";
import { useFilesContext } from "./files-client";

interface FileBatchProps {
    files: PullRequestFile[];
    owner: string;
    repo: string;
    number: string;
    page: number;
}

export function FileBatch({
    files,
    owner,
    repo,
    number,
    page,
}: FileBatchProps) {
    const ctx = useFilesContext();
    const pr = use(ctx.pullRequestPromise);

    const OVERFLOW_THRESHOLD = 200;
    const baseSha = pr.base.sha;
    const headSha = pr.head.sha ?? ctx.commitSha;

    return files.map((file, batchIndex) => {
        const fileComments: ReviewComment[] = ctx.allCommentsAll.filter(
            (c) => c.path === file.filename,
        );
        const fileId = file.filename.replace(/\//g, "-");
        const totalChanged = file.additions + file.deletions;
        const globalIndex = (page - 1) * 30 + batchIndex;
        const isOverflow =
            globalIndex >= OVERFLOW_THRESHOLD ||
            file.status === "removed" ||
            totalChanged > 1000;

        return (
            <LazyRenderItem
                className="scroll-mt-[calc(var(--header-height)+8px)]"
                heightMap={ctx.heightMapRef.current}
                id={fileId}
                itemKey={file.filename}
                key={file.filename}
                renderOnIds={[
                    ...fileComments.map((c) => `review-thread-${c.id}`),
                    fileId,
                ]}
            >
                <FileDiff
                    baseSha={baseSha}
                    headSha={headSha}
                    comments={fileComments}
                    file={file}
                    number={number}
                    onToggleGeneratedDiff={() =>
                        ctx.toggleGeneratedFile(file.filename)
                    }
                    onTogglePerformanceDiff={() =>
                        ctx.toggleOverflowFile(file.filename)
                    }
                    owner={owner}
                    pendingReviewId={ctx.pendingReviewId}
                    performanceHidden={isOverflow}
                    repo={repo}
                    showComments={ctx.showComments}
                    showGeneratedDiff={
                        ctx.expandedGeneratedFiles.has(file.filename) ||
                        (isOverflow &&
                            ctx.expandedOverflowFiles.has(file.filename))
                    }
                    showPerformanceDiff={ctx.expandedOverflowFiles.has(
                        file.filename,
                    )}
                />
            </LazyRenderItem>
        );
    });
}
