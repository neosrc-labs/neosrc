"use client";

import { useEffect } from "react";

export function DocumentTitleSetter({
    titlePromise,
}: {
    titlePromise: Promise<string>;
}) {
    useEffect(() => {
        let active = true;
        titlePromise.then((title) => {
            if (active) {
                document.title = title;
            }
        });
        return () => {
            active = false;
        };
    }, [titlePromise]);
    return null;
}
