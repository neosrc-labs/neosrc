import { headers } from "next/headers";
import {
    EXTENSION_EXIT_PARAM,
    EXTENSION_REQUEST_HEADER,
    externalUrlForNeosrcPath,
} from "~/utils/extension-routes";

/**
 * Host URL to send a browser back to when Neosrc cannot serve the page it asked
 * for and the extension is the reason it is here. Null for direct visits, which
 * keep the not-found UI and its sign-in prompt.
 */
export async function externalFallbackTarget(): Promise<string | null> {
    const requestHeaders = await headers();
    if (!requestHeaders.get(EXTENSION_REQUEST_HEADER)) return null;

    // Set by src/proxy.ts for every page request.
    const pathname = requestHeaders.get("x-pathname");
    if (!pathname) return null;

    const external = externalUrlForNeosrcPath(pathname);
    if (!external) return null;

    // The marker keeps the extension from redirecting straight back here and
    // keeps GitHub from being re-entered through Neosrc on the way.
    return `${external}?${EXTENSION_EXIT_PARAM}=1`;
}
