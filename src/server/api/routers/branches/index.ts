import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    createTRPCRouter,
    providerInput,
    providerMutation,
    providerQuery,
} from "~/server/api/trpc";
import {
    deleteBranch as deleteCodebergBranch,
    getCachedRepo as getCodebergRepo,
    renameBranch as renameCodebergBranch,
} from "~/server/codeberg";
import {
    deleteRepoBranch,
    getCachedRepo as getGitHubRepo,
    renameRepoBranch,
} from "~/server/github";
import { codebergBranchProvider } from "./codeberg";
import { githubBranchProvider } from "./github";

/**
 * Provider rejections carry the message the dialog shows. GitHub answers with
 * HTTP-shaped errors (`status`), Forgejo with a plain Error.
 */
function rejectBranchMutation(error: unknown, provider: "gh" | "cb"): never {
    const isProviderError =
        provider === "cb"
            ? error instanceof Error
            : typeof error === "object" && error !== null && "status" in error;
    if (!isProviderError) throw error;

    throw new TRPCError({
        code: "BAD_REQUEST",
        message:
            error instanceof Error && error.message !== ""
                ? error.message
                : "The provider rejected the branch change",
    });
}

export const branchesRouter = createTRPCRouter({
    list: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            tab: z
                .enum(["overview", "active", "stale", "all"])
                .default("overview"),
            query: z.string().trim().default(""),
            page: z.number().int().min(1).default(1),
        }),
        userId: "anonymous",
        gh: ({ accessToken, input }) =>
            githubBranchProvider.list({ ...input, accessToken }),
        cb: ({ accessToken, input }) =>
            codebergBranchProvider.list({ ...input, accessToken }),
    }),

    deleteBranch: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            branch: z.string().min(1),
        }),
        gh: async ({ accessToken, input }) => {
            const repoInfo = await getGitHubRepo(
                accessToken,
                input.owner,
                input.repo,
            );
            if (repoInfo.default_branch === input.branch) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default branch cannot be deleted",
                });
            }
            try {
                await deleteRepoBranch(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                );
            } catch (error) {
                rejectBranchMutation(error, "gh");
            }
            return { success: true as const };
        },
        cb: async ({ accessToken, input }) => {
            const repoInfo = await getCodebergRepo(
                accessToken,
                input.owner,
                input.repo,
            );
            if (repoInfo.default_branch === input.branch) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default branch cannot be deleted",
                });
            }
            try {
                await deleteCodebergBranch(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                );
            } catch (error) {
                rejectBranchMutation(error, "cb");
            }
            return { success: true as const };
        },
    }),

    renameBranch: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            branch: z.string().min(1),
            newName: z.string().trim().min(1).max(255),
        }),
        gh: async ({ accessToken, input }) => {
            const repoInfo = await getGitHubRepo(
                accessToken,
                input.owner,
                input.repo,
            );
            if (repoInfo.default_branch === input.branch) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default branch cannot be renamed",
                });
            }
            try {
                await renameRepoBranch(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                    input.newName,
                );
            } catch (error) {
                rejectBranchMutation(error, "gh");
            }
            return { name: input.newName };
        },
        cb: async ({ accessToken, input }) => {
            const repoInfo = await getCodebergRepo(
                accessToken,
                input.owner,
                input.repo,
            );
            if (repoInfo.default_branch === input.branch) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default branch cannot be renamed",
                });
            }
            try {
                await renameCodebergBranch(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                    input.newName,
                );
            } catch (error) {
                rejectBranchMutation(error, "cb");
            }
            return { name: input.newName };
        },
    }),
});
