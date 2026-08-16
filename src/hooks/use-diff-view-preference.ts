"use client";

import { useEffect, useState } from "react";
import {
    type DiffViewMode,
    readDiffViewPreference,
    writeDiffViewPreference,
} from "~/utils/diff-view";

/** Per-repo diff view mode, persisted to localStorage like GitHub does. */
export function useDiffViewPreference(owner: string, repo: string) {
    const [view, setView] = useState<DiffViewMode>(() =>
        readDiffViewPreference(owner, repo),
    );
    useEffect(() => {
        writeDiffViewPreference(owner, repo, view);
    }, [owner, repo, view]);
    return [view, setView] as const;
}
