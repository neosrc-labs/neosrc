"use client";

import { useEffect } from "react";

/**
 * Sends the tab to the host page a Neosrc request stands for, without rendering
 * anything: the page Neosrc cannot serve is not worth showing for the frame or
 * two before the navigation starts.
 */
export function RedirectToExternal({ href }: { href: string }) {
    useEffect(() => {
        window.location.replace(href);
    }, [href]);

    return null;
}
