"use client";

import { useEffect } from "react";

export function DocumentTitleSetter({
    titlePromise,
}: {
    titlePromise: Promise<string>;
}) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: promise is stable across renders
    useEffect(() => {
        titlePromise.then((title) => {
            document.title = title;
        });
    }, []);
    return null;
}
