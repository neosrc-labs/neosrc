import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
    createTRPCRouter,
    protectedProcedure,
    providerInput,
    providerMutation,
    providerQuery,
} from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { repoStarredCacheKey, repoSubscriptionCacheKey } from "~/server/cache";
import {
    deleteRepoSubscription as deleteCodebergRepoSubscription,
    getCachedRepo as getCachedCodebergRepo,
    getCachedRepoStarred as getCachedCodebergRepoStarred,
    getCachedRepoSubscription as getCachedCodebergRepoSubscription,
    getCachedRepoCounts,
    getBranches as getCodebergBranches,
    getFileContent as getCodebergFileContent,
    getFileLatestCommit as getCodebergFileLatestCommit,
    getFileTree as getCodebergFileTree,
    getLatestCommit as getCodebergLatestCommit,
    getLatestRelease as getCodebergLatestRelease,
    getRefCounts as getCodebergRefCounts,
    getRepoContents as getCodebergRepoContents,
    getRepoLanguages as getCodebergRepoLanguages,
    getTags as getCodebergTags,
    getUserRepos as getCodebergUserRepos,
    setRepoSubscription as setCodebergRepoSubscription,
    starRepo as starCodebergRepo,
    unstarRepo as unstarCodebergRepo,
} from "~/server/codeberg";
import type { ForkComparison } from "~/server/github";
import {
    DOC_FILE_PATTERNS,
    deleteRepoSubscription,
    getCachedDocFileContent,
    getCachedRepo,
    getCachedRepoContributors,
    getCachedRepoDocFileNames,
    getCachedRepoIssuePullCounts,
    getCachedRepoLanguages,
    getCachedRepoStarred,
    getCachedRepoSubscription,
    getDocFileDisplayName,
    getDocFileSortKey,
    getFileLatestCommits,
    getForkComparison,
    getUserRepos as getGitHubUserRepos,
    getLatestRelease,
    getRepoBranches,
    getRepoContents,
    getRepoDeployments,
    getRepoDocFiles,
    getRepoFileTree,
    getRepoLatestCommit,
    getRepoRefCounts,
    getRepoTags,
    mergeForkUpstream,
    setRepoSubscription,
    starRepo,
    unstarRepo,
} from "~/server/github";
import { getTopRepositories } from "~/server/github-graphql";
import {
    getRepoPermissionForUser,
    RepoNotFoundError,
    viewerRepoAccess,
} from "~/server/repo-cache";

/**
 * Maps the repo cache's miss (its fetcher returned null: repo absent or the
 * token cannot read it) to a tRPC 404, so the same unauthorized request reads
 * as NOT_FOUND whether the repo table was already warm or not.
 */
async function repoNotFoundAsTrpc<T>(promise: Promise<T>): Promise<T> {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof RepoNotFoundError) {
            throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw error;
    }
}

export type RepositoryInfo = {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    archived: boolean;
    archivedAt: string | null;
    permissions: {
        admin: boolean;
        write: boolean;
    };
    ownerAvatarUrl: string;
    allowSquashMerge: boolean | null;
    allowRebaseMerge: boolean | null;
    allowMergeCommit: boolean | null;
    allowAutoMerge: boolean | null;
    description: string | null;
    defaultBranch: string | null;
    homepage: string | null;
    stars: number;
    forks: number;
    watchers: number;
    language: string | null;
    topics: string[];
    license: {
        spdxId: string | null;
        name: string;
        url: string | null;
    } | null;
    createdAt: string | null;
    isFork: boolean;
    parentFullName: string | null;
    parentDefaultBranch: string | null;
};

export const reposRouter = createTRPCRouter({
    getByOwnerAndRepo: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        userId: "anonymous",
        cb: async ({ ctx, input, accessToken }): Promise<RepositoryInfo> => {
            const username = ctx.session?.user?.codebergUsername ?? null;
            const [data, permission] = await Promise.all([
                repoNotFoundAsTrpc(
                    getCachedCodebergRepo(accessToken, input.owner, input.repo),
                ),
                getRepoPermissionForUser(
                    "codeberg",
                    username,
                    input.owner,
                    input.repo,
                ),
            ]);

            const access = viewerRepoAccess({
                username,
                payload: data,
                permission,
            });
            if (!access.canView) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            return {
                hasIssues: data.has_issues,
                hasWiki: data.has_wiki,
                hasProjects: data.has_projects,
                hasDiscussions: false,
                isPrivate: data.private,
                archived: data.archived,
                archivedAt: data.archived_at,
                permissions: {
                    admin: access.admin,
                    write: access.write,
                },
                ownerAvatarUrl: data.owner.avatar_url,
                allowSquashMerge: data.allow_squash_merge,
                allowRebaseMerge: data.allow_rebase,
                allowMergeCommit: data.allow_merge_commits,
                allowAutoMerge: null,
                description: data.description ?? null,
                defaultBranch: data.default_branch ?? null,
                homepage: data.website ?? null,
                stars: data.stars_count,
                forks: data.forks_count,
                watchers: data.watchers_count,
                language: data.language ?? null,
                topics: data.topics ?? [],
                license: data.license
                    ? {
                          spdxId: null,
                          name: data.license.name,
                          url: data.license.url ?? null,
                      }
                    : null,
                createdAt: data.created_at,
                isFork: data.fork,
                parentFullName: data.parent?.full_name ?? null,
                parentDefaultBranch: data.parent?.default_branch ?? null,
            } satisfies RepositoryInfo;
        },
        gh: async ({ ctx, input, accessToken }): Promise<RepositoryInfo> => {
            const username = ctx.session?.user?.githubUsername ?? null;
            const [data, permission] = await Promise.all([
                repoNotFoundAsTrpc(
                    getCachedRepo(accessToken, input.owner, input.repo),
                ),
                getRepoPermissionForUser(
                    "github",
                    username,
                    input.owner,
                    input.repo,
                ),
            ]);

            const access = viewerRepoAccess({
                username,
                payload: data,
                permission,
            });
            if (!access.canView) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            return {
                hasIssues: data.has_issues,
                hasWiki: data.has_wiki,
                hasProjects: data.has_projects,
                hasDiscussions: data.has_discussions,
                isPrivate: data.private,
                archived: data.archived,
                archivedAt: null,
                permissions: {
                    admin: access.admin,
                    write: access.write,
                },
                ownerAvatarUrl: data.owner.avatar_url,
                allowSquashMerge: data.allow_squash_merge ?? null,
                allowRebaseMerge: data.allow_rebase_merge ?? null,
                allowMergeCommit: data.allow_merge_commit ?? null,
                allowAutoMerge: data.allow_auto_merge ?? null,
                description: data.description ?? null,
                defaultBranch: data.default_branch,
                homepage: data.homepage ?? null,
                stars: data.stargazers_count,
                forks: data.forks_count,
                watchers: data.subscribers_count,
                language: data.language ?? null,
                topics: data.topics ?? [],
                license: data.license
                    ? {
                          spdxId: data.license.spdx_id ?? null,
                          name: data.license.name,
                          url: data.license.url ?? null,
                      }
                    : null,
                createdAt: data.created_at,
                isFork: data.fork,
                parentFullName: data.parent?.full_name ?? null,
                parentDefaultBranch: data.parent?.default_branch ?? null,
            } satisfies RepositoryInfo;
        },
    }),
    getCountsByOwnerAndRepo: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        userId: "anonymous",
        cb: ({ accessToken, userId, input }) =>
            getCachedRepoCounts(accessToken, userId, input.owner, input.repo),
        gh: ({ accessToken, userId, input }) =>
            getCachedRepoIssuePullCounts(
                accessToken,
                userId,
                input.owner,
                input.repo,
            ),
    }),
    getTopRepos: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.isAnonymous) return [];
        const accessToken = await getGitHubToken(ctx.db, ctx.session?.user?.id);
        return getTopRepositories(accessToken);
    }),
    getBranches: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergBranches(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            getRepoBranches(accessToken, input.owner, input.repo),
    }),
    getTags: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergTags(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            getRepoTags(accessToken, input.owner, input.repo),
    }),
    getRefCounts: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergRefCounts(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            getRepoRefCounts(accessToken, input.owner, input.repo),
    }),
    getLatestCommit: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string().optional(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergLatestCommit(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            ),
        gh: ({ accessToken, input }) =>
            getRepoLatestCommit(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            ),
    }),
    getForkComparison: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            upstreamFullName: z.string(),
            forkBranch: z.string(),
            parentBranch: z.string(),
        }),
        cbFallback: (): ForkComparison | null => null,
        gh: ({ accessToken, input }) =>
            getForkComparison(
                accessToken,
                input.owner,
                input.repo,
                input.upstreamFullName,
                input.forkBranch,
                input.parentBranch,
            ),
    }),
    mergeUpstream: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            branch: z.string(),
        }),
        cbFallback: () => {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Merging upstream is not supported on Codeberg",
            });
        },
        gh: ({ accessToken, input }) =>
            mergeForkUpstream(
                accessToken,
                input.owner,
                input.repo,
                input.branch,
            ),
    }),
    getFileLatestCommits: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string(),
            paths: z.array(z.string()),
        }),
        cb: async ({ input, accessToken }) => {
            const result: Record<
                string,
                {
                    sha: string;
                    message: string;
                    committedDate: string;
                } | null
            > = {};
            const promises = input.paths.map(async (p) => {
                result[p] = await getCodebergFileLatestCommit(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.ref,
                    p,
                );
            });
            await Promise.all(promises);
            return result;
        },
        gh: ({ accessToken, userId, input }) =>
            getFileLatestCommits(
                accessToken,
                userId ?? "anonymous",
                input.owner,
                input.repo,
                input.ref,
                input.paths,
            ),
    }),
    getContents: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            path: z.string().optional(),
            ref: z.string().optional(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergRepoContents(
                accessToken,
                input.owner,
                input.repo,
                input.path,
                input.ref,
            ),
        gh: ({ accessToken, input }) =>
            getRepoContents(
                accessToken,
                input.owner,
                input.repo,
                input.path,
                input.ref,
            ),
    }),
    getFileTree: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergFileTree(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            ),
        gh: ({ accessToken, input }) =>
            getRepoFileTree(accessToken, input.owner, input.repo, input.ref),
    }),
    getDocFileNames: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string().optional(),
        }),
        cb: async ({ input, accessToken }) => {
            const items = await getCodebergRepoContents(
                accessToken,
                input.owner,
                input.repo,
                undefined,
                input.ref,
            );
            const docItems = items.filter(
                (item) =>
                    item.type === "file" &&
                    DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
            );
            return docItems
                .map((item) => ({
                    name: item.name,
                    path: item.path,
                    displayName: getDocFileDisplayName(item.name),
                }))
                .sort((a, b) =>
                    getDocFileSortKey(a.name).localeCompare(
                        getDocFileSortKey(b.name),
                    ),
                );
        },
        gh: ({ accessToken, userId, input }) =>
            getCachedRepoDocFileNames(
                accessToken,
                userId ?? "anonymous",
                input.owner,
                input.repo,
                input.ref,
            ),
    }),
    getRepoLanguages: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergRepoLanguages(accessToken, input.owner, input.repo),
        gh: ({ accessToken, userId, input }) =>
            getCachedRepoLanguages(
                accessToken,
                userId ?? "anonymous",
                input.owner,
                input.repo,
            ),
    }),
    getDocFiles: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string().optional(),
        }),
        cbFallback: () => [],
        gh: ({ accessToken, input }) =>
            getRepoDocFiles(accessToken, input.owner, input.repo, input.ref),
    }),
    getDocFileContent: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            ref: z.string(),
            path: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergFileContent(
                accessToken,
                input.owner,
                input.repo,
                input.path,
                input.ref,
            ),
        gh: ({ accessToken, userId, input }) =>
            getCachedDocFileContent(
                accessToken,
                userId ?? "anonymous",
                input.owner,
                input.repo,
                input.ref,
                input.path,
            ),
    }),
    getContributors: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cbFallback: () => [],
        gh: ({ accessToken, userId, input }) =>
            getCachedRepoContributors(
                accessToken,
                userId ?? "anonymous",
                input.owner,
                input.repo,
            ),
    }),
    getDeployments: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cbFallback: () => [],
        gh: ({ accessToken, input }) =>
            getRepoDeployments(accessToken, input.owner, input.repo),
    }),
    getLatestRelease: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            getCodebergLatestRelease(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            getLatestRelease(accessToken, input.owner, input.repo),
    }),
    getStarred: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (!ctx.session?.user) return false;
            const userId = ctx.session.user.id;
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(ctx.db, userId);
                return getCachedCodebergRepoStarred(
                    accessToken,
                    input.owner,
                    input.repo,
                    userId,
                );
            }
            const accessToken = await getGitHubToken(ctx.db, userId);
            return getCachedRepoStarred(
                accessToken,
                input.owner,
                input.repo,
                userId,
            );
        }),
    star: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            starCodebergRepo(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            starRepo(accessToken, input.owner, input.repo),
        evict: ({ provider, userId, input }) =>
            repoStarredCacheKey(provider, userId, input.owner, input.repo),
    }),
    unstar: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            unstarCodebergRepo(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            unstarRepo(accessToken, input.owner, input.repo),
        evict: ({ provider, userId, input }) =>
            repoStarredCacheKey(provider, userId, input.owner, input.repo),
    }),
    getSubscription: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        userId: "anonymous",
        cb: ({ accessToken, userId, input }) =>
            getCachedCodebergRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                userId,
            ),
        gh: ({ accessToken, userId, input }) =>
            getCachedRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                userId,
            ),
    }),
    setSubscription: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            subscribed: z.boolean(),
            ignored: z.boolean(),
        }),
        cb: ({ accessToken, input }) =>
            setCodebergRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                input.subscribed,
                input.ignored,
            ),
        gh: ({ accessToken, input }) =>
            setRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                input.subscribed,
                input.ignored,
            ),
        evict: ({ provider, userId, input }) =>
            repoSubscriptionCacheKey(provider, userId, input.owner, input.repo),
    }),
    deleteSubscription: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            deleteCodebergRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
            ),
        gh: ({ accessToken, input }) =>
            deleteRepoSubscription(accessToken, input.owner, input.repo),
        evict: ({ provider, userId, input }) =>
            repoSubscriptionCacheKey(provider, userId, input.owner, input.repo),
    }),
    getAllMyRepos: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.session?.user) return [];
        const userId = ctx.session.user.id;
        const results: {
            provider: "github" | "codeberg";
            owner: string;
            name: string;
            fullName: string;
        }[] = [];

        const settled = await Promise.allSettled([
            getGitHubToken(ctx.db, userId).then((token) =>
                getGitHubUserRepos(token),
            ),
            getCodebergToken(ctx.db, userId).then((token) =>
                getCodebergUserRepos(token),
            ),
        ]);

        if (settled[0]?.status === "fulfilled") {
            for (const r of settled[0].value) {
                results.push({ provider: "github", ...r });
            }
        }

        if (settled[1]?.status === "fulfilled") {
            for (const r of settled[1].value) {
                results.push({ provider: "codeberg", ...r });
            }
        }

        return results;
    }),
});
