"use client";

import { useRef, useState } from "react";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { isGeneratedFile } from "~/utils/generated-files";
import { getStoredSet, getViewedKey, setStoredSet } from "~/utils/viewed-files";
import type { DiffCommentTarget } from "./diff/types";

export function useFileDiffState({
    owner,
    repo,
    number,
    filename,
}: {
    owner: string;
    repo: string;
    number: string;
    filename: string;
}) {
    const [isViewed, setIsViewed] = useState(() => {
        if (typeof window === "undefined") return false;
        return getStoredSet(getViewedKey(owner, repo, number)).has(filename);
    });
    const [isCollapsed, setIsCollapsed] = useState(
        () => isViewed || isGeneratedFile(filename),
    );
    const [activeComment, setActiveComment] =
        useState<DiffCommentTarget | null>(null);
    const commentKey = `pr-autosave:inline:${owner}:${repo}:${number}:${filename}`;
    const [commentBody, setCommentBody] = useState(
        () => readAutosave(commentKey) ?? "",
    );
    const { clear: clearComment } = useAutosave(commentKey, commentBody);
    const [expandedAll, setExpandedAll] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);

    const toggleWithScrollAdjust = (
        nextValue: boolean,
        collapsedValue: boolean,
        setValue: (next: boolean) => void,
    ) => {
        const stickyOffset = 56;
        if (nextValue === collapsedValue && headerRef.current) {
            const headerTop = headerRef.current.getBoundingClientRect().top;
            if (Math.abs(headerTop - stickyOffset) < 20) {
                setValue(nextValue);
                setTimeout(() => {
                    if (!headerRef.current) return;
                    const delta =
                        headerRef.current.getBoundingClientRect().top -
                        stickyOffset;
                    if (Math.abs(delta) > 1) window.scrollBy(0, delta);
                }, 0);
                return;
            }
        }
        setValue(nextValue);
    };

    const toggleCollapsed = () =>
        toggleWithScrollAdjust(!isCollapsed, true, setIsCollapsed);
    const toggleExpandAll = () =>
        toggleWithScrollAdjust(!expandedAll, false, setExpandedAll);

    const toggleViewed = () => {
        const key = getViewedKey(owner, repo, number);
        const viewed = getStoredSet(key);
        if (isViewed) viewed.delete(filename);
        else viewed.add(filename);
        setStoredSet(key, viewed);
        setIsViewed(!isViewed);
        if (isViewed === isCollapsed) toggleCollapsed();
        window.dispatchEvent(new Event("file-viewed-changed"));
    };

    const toggleFileComment = () => {
        setActiveComment((current) =>
            current?.type === "file" ? null : { type: "file" },
        );
    };

    return {
        isViewed,
        isCollapsed,
        activeComment,
        commentBody,
        expandedAll,
        headerRef,
        setActiveComment,
        setCommentBody,
        toggleCollapsed,
        toggleExpandAll,
        toggleViewed,
        toggleFileComment,
        isFileCommentOpen: activeComment?.type === "file",
        clearComment,
    };
}
