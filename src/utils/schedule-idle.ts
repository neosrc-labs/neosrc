export function scheduleIdle(callback: () => void): () => void {
    if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(callback, { timeout: 1_000 });
        return () => cancelIdleCallback(id);
    }
    // jsdom and older environments: run on the next macrotask instead.
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
}
