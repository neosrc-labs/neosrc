"use client";

import { useEffect, useRef } from "react";

import { api } from "~/trpc/react";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * Keeps the current user's permissions fresh while the consumer is mounted:
 * runs the lightweight incremental sync immediately and then every
 * `intervalMs` (default 30s). Incremental polls skip all writes and the
 * materialized-view refresh while the permission snapshot is unchanged, so a
 * tick is just a few list requests plus a hash comparison; a full re-sync
 * only happens when the snapshot actually changed.
 */
export function useIncrementalSync(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    const poll = api.sync.poll.useMutation();
    const pollRef = useRef(poll);
    pollRef.current = poll;

    useEffect(() => {
        pollRef.current.mutate();
        const id = setInterval(() => pollRef.current.mutate(), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    return poll;
}
