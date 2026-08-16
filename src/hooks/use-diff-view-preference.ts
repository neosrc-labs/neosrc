"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    type DiffViewMode,
    readDiffViewPreference,
    writeDiffViewPreference,
} from "~/utils/diff-view";

/**
 * Per-repo diff view mode, persisted to localStorage like GitHub does.
 *
 * Hydration-safe: state starts at "unified" on both server and client, then
 * the stored preference is loaded in an effect after mount and whenever
 * owner/repo change. Persistence happens only through the returned setter, so
 * a previous repository's mode can never be written into a new repository's
 * key before its own preference is loaded.
 */
export function useDiffViewPreference(owner: string, repo: string) {
    const [view, setView] = useState<DiffViewMode>("unified");
    const hydratedForRef = useRef<string | null>(null);

    useEffect(() => {
        const key = `${owner}:${repo}`;
        if (hydratedForRef.current === key) return;
        hydratedForRef.current = key;
        setView(readDiffViewPreference(owner, repo));
    }, [owner, repo]);

    const changeView = useCallback(
        (next: DiffViewMode) => {
            setView(next);
            writeDiffViewPreference(owner, repo, next);
        },
        [owner, repo],
    );

    return [view, changeView] as const;
}
