import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    getGhToken,
    getProviderToken,
    providerTargetInput,
    requireUserId,
} from "~/server/api/routers/helpers";
import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import {
    deleteCache,
    repoStarredCacheKey,
    repoSubscriptionCacheKey,
} from "~/server/cache";
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
    permissions: {
        admin: boolean;
    };
    ownerAvatarUrl: string;
    allowSquashMerge: boolean | null;
    allowRebaseMerge: boolean | null;
    allowMergeCommit: boolean | null;
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

/**
 * Fetches a repo payload (mapping cache misses to a tRPC 404) plus the
 * viewer's effective permission, then enforces the shared viewer-access gate.
 * Throws NOT_FOUND when the repo is absent or the viewer cannot see it.
 */
async function getViewableRepo<
    TData extends { owner: { login: string }; private: boolean },
>(args: {
    provider: "codeberg" | "github";
    accessToken: string;
    username: string | null;
    owner: string;
    repo: string;
    fetch: (accessToken: string, owner: string, repo: string) => Promise<TData>;
}): Promise<{ data: TData; access: ReturnType<typeof viewerRepoAccess> }> {
    const [data, permission] = await Promise.all([
        repoNotFoundAsTrpc(args.fetch(args.accessToken, args.owner, args.repo)),
        getRepoPermissionForUser(
            args.provider,
            args.username,
            args.owner,
            args.repo,
        ),
    ]);

    const access = viewerRepoAccess({
        username: args.username,
        payload: data,
        permission,
    });
    if (!access.canView) {
        throw new TRPCError({ code: "NOT_FOUND" });
    }
    return { data, access };
}

/**
 * The shared tail of the repo-info mapping: timestamps, fork state, and the
 * parent reference. Kept in one place so the codeberg/github branches can't
 * drift apart.
 */
function repositoryInfoTail(data: {
    created_at: string | null;
    fork: boolean;
    parent?: {
        full_name: string | null;
        default_branch: string | null;
    } | null;
}): Pick<
    RepositoryInfo,
    "createdAt" | "isFork" | "parentFullName" | "parentDefaultBranch"
> {
    return {
        createdAt: data.created_at,
        isFork: data.fork,
        parentFullName: data.parent?.full_name ?? null,
        parentDefaultBranch: data.parent?.default_branch ?? null,
    };
}

export const reposRouter = createTRPCRouter({
    getByOwnerAndRepo: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }): Promise<RepositoryInfo> => {
            const userId = ctx.session?.user?.id ?? "anonymous";
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(ctx.db, userId);
                const username = ctx.session?.user?.codebergUsername ?? null;
                const { data, access } = await getViewableRepo({
                    provider: "codeberg",
                    accessToken,
                    username,
                    owner: input.owner,
                    repo: input.repo,
                    fetch: getCachedCodebergRepo,
                });

                return {
                    hasIssues: data.has_issues,
                    hasWiki: data.has_wiki,
                    hasProjects: data.has_projects,
                    hasDiscussions: false,
                    isPrivate: data.private,
                    permissions: {
                        admin: access.admin,
                    },
                    ownerAvatarUrl: data.owner.avatar_url,
                    allowSquashMerge: data.allow_squash_merge,
                    allowRebaseMerge: data.allow_rebase,
                    allowMergeCommit: data.allow_merge_commits,
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
                    ...repositoryInfoTail(data),
                } satisfies RepositoryInfo;
            }

            const accessToken = await getGitHubToken(ctx.db, userId);

            const username = ctx.session?.user?.githubUsername ?? null;
            const { data, access } = await getViewableRepo({
                provider: "github",
                accessToken,
                username,
                owner: input.owner,
                repo: input.repo,
                fetch: getCachedRepo,
            });

            return {
                hasIssues: data.has_issues,
                hasWiki: data.has_wiki,
                hasProjects: data.has_projects,
                hasDiscussions: data.has_discussions,
                isPrivate: data.private,
                permissions: {
                    admin: access.admin,
                },
                ownerAvatarUrl: data.owner.avatar_url,
                allowSquashMerge: data.allow_squash_merge ?? null,
                allowRebaseMerge: data.allow_rebase_merge ?? null,
                allowMergeCommit: data.allow_merge_commit ?? null,
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
                ...repositoryInfoTail(data),
            } satisfies RepositoryInfo;
        }),
    getCountsByOwnerAndRepo: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id ?? "anonymous";
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCachedRepoCounts(
                      accessToken,
                      userId,
                      input.owner,
                      input.repo,
                  )
                : getCachedRepoIssuePullCounts(
                      accessToken,
                      userId,
                      input.owner,
                      input.repo,
                  );
        }),
    getTopRepos: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.isAnonymous) return [];
        const accessToken = await getGitHubToken(ctx.db, ctx.session?.user?.id);
        return getTopRepositories(accessToken);
    }),
    getBranches: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergBranches(accessToken, input.owner, input.repo)
                : getRepoBranches(accessToken, input.owner, input.repo);
        }),
    getTags: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergTags(accessToken, input.owner, input.repo)
                : getRepoTags(accessToken, input.owner, input.repo);
        }),
    getRefCounts: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergRefCounts(accessToken, input.owner, input.repo)
                : getRepoRefCounts(accessToken, input.owner, input.repo);
        }),
    getLatestCommit: protectedProcedure
        .input(providerTargetInput.extend({ ref: z.string().optional() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergLatestCommit(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.ref,
                  )
                : getRepoLatestCommit(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.ref,
                  );
        }),
    getForkComparison: protectedProcedure
        .input(
            providerTargetInput.extend({
                upstreamFullName: z.string(),
                forkBranch: z.string(),
                parentBranch: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return null;
            const accessToken = await getGhToken(ctx);
            return getForkComparison(
                accessToken,
                input.owner,
                input.repo,
                input.upstreamFullName,
                input.forkBranch,
                input.parentBranch,
            );
        }),
    mergeUpstream: protectedMutation
        .input(providerTargetInput.extend({ branch: z.string() }))
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Merging upstream is not supported on Codeberg",
                });
            }
            const accessToken = await getGhToken(ctx);
            return mergeForkUpstream(
                accessToken,
                input.owner,
                input.repo,
                input.branch,
            );
        }),
    getFileLatestCommits: protectedProcedure
        .input(
            providerTargetInput.extend({
                ref: z.string(),
                paths: z.array(z.string()),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
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
            }
            return getFileLatestCommits(
                accessToken,
                ctx.session?.user?.id ?? "anonymous",
                input.owner,
                input.repo,
                input.ref,
                input.paths,
            );
        }),
    getContents: protectedProcedure
        .input(
            providerTargetInput.extend({
                path: z.string().optional(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergRepoContents(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.path,
                      input.ref,
                  )
                : getRepoContents(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.path,
                      input.ref,
                  );
        }),
    getFileTree: protectedProcedure
        .input(providerTargetInput.extend({ ref: z.string() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergFileTree(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.ref,
                  )
                : getRepoFileTree(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.ref,
                  );
        }),
    getDocFileNames: protectedProcedure
        .input(providerTargetInput.extend({ ref: z.string().optional() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
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
            }
            return getCachedRepoDocFileNames(
                accessToken,
                ctx.session?.user?.id ?? "anonymous",
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getRepoLanguages: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergRepoLanguages(accessToken, input.owner, input.repo)
                : getCachedRepoLanguages(
                      accessToken,
                      ctx.session?.user?.id ?? "anonymous",
                      input.owner,
                      input.repo,
                  );
        }),
    getDocFiles: protectedProcedure
        .input(providerTargetInput.extend({ ref: z.string().optional() }))
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGhToken(ctx);
            return getRepoDocFiles(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getDocFileContent: protectedProcedure
        .input(
            providerTargetInput.extend({
                ref: z.string(),
                path: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergFileContent(
                      accessToken,
                      input.owner,
                      input.repo,
                      input.path,
                      input.ref,
                  )
                : getCachedDocFileContent(
                      accessToken,
                      ctx.session?.user?.id ?? "anonymous",
                      input.owner,
                      input.repo,
                      input.ref,
                      input.path,
                  );
        }),
    getContributors: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGhToken(ctx);
            return getCachedRepoContributors(
                accessToken,
                ctx.session?.user?.id ?? "anonymous",
                input.owner,
                input.repo,
            );
        }),
    getDeployments: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGhToken(ctx);
            return getRepoDeployments(accessToken, input.owner, input.repo);
        }),
    getLatestRelease: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCodebergLatestRelease(accessToken, input.owner, input.repo)
                : getLatestRelease(accessToken, input.owner, input.repo);
        }),
    getStarred: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            if (!ctx.session?.user) return false;
            const userId = ctx.session.user.id;
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCachedCodebergRepoStarred(
                      accessToken,
                      input.owner,
                      input.repo,
                      userId,
                  )
                : getCachedRepoStarred(
                      accessToken,
                      input.owner,
                      input.repo,
                      userId,
                  );
        }),
    star: protectedProcedure
        .input(providerTargetInput)
        .mutation(async ({ ctx, input }) => {
            const userId = requireUserId(ctx);
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
                await starCodebergRepo(accessToken, input.owner, input.repo);
                await deleteCache(
                    repoStarredCacheKey("cb", userId, input.owner, input.repo),
                );
                return;
            }
            await starRepo(accessToken, input.owner, input.repo);
            await deleteCache(
                repoStarredCacheKey("gh", userId, input.owner, input.repo),
            );
        }),
    unstar: protectedProcedure
        .input(providerTargetInput)
        .mutation(async ({ ctx, input }) => {
            const userId = requireUserId(ctx);
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
                await unstarCodebergRepo(accessToken, input.owner, input.repo);
                await deleteCache(
                    repoStarredCacheKey("cb", userId, input.owner, input.repo),
                );
                return;
            }
            await unstarRepo(accessToken, input.owner, input.repo);
            await deleteCache(
                repoStarredCacheKey("gh", userId, input.owner, input.repo),
            );
        }),
    getSubscription: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id ?? "anonymous";
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? getCachedCodebergRepoSubscription(
                      accessToken,
                      input.owner,
                      input.repo,
                      userId,
                  )
                : getCachedRepoSubscription(
                      accessToken,
                      input.owner,
                      input.repo,
                      userId,
                  );
        }),
    setSubscription: protectedProcedure
        .input(
            providerTargetInput.extend({
                subscribed: z.boolean(),
                ignored: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = requireUserId(ctx);
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
                await setCodebergRepoSubscription(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.subscribed,
                    input.ignored,
                );
                await deleteCache(
                    repoSubscriptionCacheKey(
                        "cb",
                        userId,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            await setRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                input.subscribed,
                input.ignored,
            );
            await deleteCache(
                repoSubscriptionCacheKey("gh", userId, input.owner, input.repo),
            );
        }),
    deleteSubscription: protectedProcedure
        .input(providerTargetInput)
        .mutation(async ({ ctx, input }) => {
            const userId = requireUserId(ctx);
            const accessToken = await getProviderToken(ctx, input.provider);
            if (input.provider === "cb") {
                await deleteCodebergRepoSubscription(
                    accessToken,
                    input.owner,
                    input.repo,
                );
                await deleteCache(
                    repoSubscriptionCacheKey(
                        "cb",
                        userId,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            await deleteRepoSubscription(accessToken, input.owner, input.repo);
            await deleteCache(
                repoSubscriptionCacheKey("gh", userId, input.owner, input.repo),
            );
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
