import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";
import type { RepoData } from "~/app/[owner]/[repo]/_components/repo-code-page";
import { fallbackToExternal } from "~/server/extension-fallback";

/**
 * Resolves the repository metadata a code page streams to its client shell.
 *
 * A repository Neosrc cannot read has to end on the host when the extension
 * sent the visitor here, and on the 404 page otherwise. It cannot stay rejected:
 * the shell unwraps its props with `use()`, so a rejection would render the 500
 * boundary instead. Only NOT_FOUND is translated; rate limits and outages still
 * surface as errors.
 */
export async function requireRepoData(
    repoData: Promise<RepoData>,
): Promise<RepoData> {
    try {
        return await repoData;
    } catch (error) {
        if (error instanceof TRPCError && error.code === "NOT_FOUND") {
            // Resolved before the page renders, so this is a real redirect.
            await fallbackToExternal();
            notFound();
        }
        throw error;
    }
}
