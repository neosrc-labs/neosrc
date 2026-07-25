import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
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

export const reposRouter = createTRPCRouter({
    getByOwnerAndRepo: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                const data = await getCachedCodebergRepo(
                    accessToken,
                    ctx.session.user.id,
                    input.owner,
                    input.repo,
                );
                return {
                    hasIssues: data.has_issues,
                    hasWiki: data.has_wiki,
                    hasProjects: data.has_projects,
                    hasDiscussions: false,
                    isPrivate: data.private,
                    permissions: {
                        admin: data.permissions.admin,
                    },
                    ownerAvatarUrl: data.owner.avatar_url,
                    allowSquashMerge: data.allow_squash_merge,
                    allowRebaseMerge: data.allow_rebase,
                    allowMergeCommit: data.allow_merge_commits,
                    description: data.description ?? "",
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
                };
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const data = await getCachedRepo(
                accessToken,
                ctx.session.user.id,
                input.owner,
                input.repo,
            );

            return {
                hasIssues: data.has_issues,
                hasWiki: data.has_wiki,
                hasProjects: data.has_projects,
                hasDiscussions: data.has_discussions,
                isPrivate: data.private,
                permissions: {
                    admin: data.permissions?.admin ?? false,
                },
                ownerAvatarUrl: data.owner.avatar_url,
                allowSquashMerge: data.allow_squash_merge,
                allowRebaseMerge: data.allow_rebase_merge,
                allowMergeCommit: data.allow_merge_commit,
                description: data.description ?? "",
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
            };
        }),
    getCountsByOwnerAndRepo: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCachedRepoCounts(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoIssuePullCounts(
                accessToken,
                input.owner,
                input.repo,
            );
        }),
    getTopRepos: protectedProcedure.query(async ({ ctx }) => {
        const accessToken = await getGitHubToken(ctx.db, ctx.session.user.id);
        return getTopRepositories(accessToken);
    }),
    getBranches: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergBranches(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoBranches(accessToken, input.owner, input.repo);
        }),
    getTags: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergTags(accessToken, input.owner, input.repo);
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoTags(accessToken, input.owner, input.repo);
        }),
    getRefCounts: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergRefCounts(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoRefCounts(accessToken, input.owner, input.repo);
        }),
    getLatestCommit: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergLatestCommit(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.ref,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoLatestCommit(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getForkComparison: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                upstreamFullName: z.string(),
                forkBranch: z.string(),
                parentBranch: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return null;
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getForkComparison(
                accessToken,
                input.owner,
                input.repo,
                input.upstreamFullName,
                input.forkBranch,
                input.parentBranch,
            );
        }),
    mergeUpstream: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                branch: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Merging upstream is not supported on Codeberg",
                });
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return mergeForkUpstream(
                accessToken,
                input.owner,
                input.repo,
                input.branch,
            );
        }),
    getFileLatestCommits: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string(),
                paths: z.array(z.string()),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getFileLatestCommits(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
                input.paths,
            );
        }),
    getContents: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                path: z.string().optional(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergRepoContents(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.path,
                    input.ref,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoContents(
                accessToken,
                input.owner,
                input.repo,
                input.path,
                input.ref,
            );
        }),
    getFileTree: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergFileTree(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.ref,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoFileTree(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getDocFileNames: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoDocFileNames(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getRepoLanguages: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergRepoLanguages(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoLanguages(accessToken, input.owner, input.repo);
        }),
    getDocFiles: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoDocFiles(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getDocFileContent: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                ref: z.string(),
                path: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergFileContent(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.path,
                    input.ref,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedDocFileContent(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
                input.path,
            );
        }),
    getContributors: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoContributors(
                accessToken,
                input.owner,
                input.repo,
            );
        }),
    getDeployments: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") return [];
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoDeployments(accessToken, input.owner, input.repo);
        }),
    getLatestRelease: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergLatestRelease(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getLatestRelease(accessToken, input.owner, input.repo);
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
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCachedCodebergRepoStarred(
                    accessToken,
                    input.owner,
                    input.repo,
                    ctx.session.user.id,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoStarred(
                accessToken,
                input.owner,
                input.repo,
                ctx.session.user.id,
            );
        }),
    star: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                await starCodebergRepo(accessToken, input.owner, input.repo);
                await deleteCache(
                    repoStarredCacheKey(
                        "cb",
                        ctx.session.user.id,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await starRepo(accessToken, input.owner, input.repo);
            await deleteCache(
                repoStarredCacheKey(
                    "gh",
                    ctx.session.user.id,
                    input.owner,
                    input.repo,
                ),
            );
        }),
    unstar: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                await unstarCodebergRepo(accessToken, input.owner, input.repo);
                await deleteCache(
                    repoStarredCacheKey(
                        "cb",
                        ctx.session.user.id,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await unstarRepo(accessToken, input.owner, input.repo);
            await deleteCache(
                repoStarredCacheKey(
                    "gh",
                    ctx.session.user.id,
                    input.owner,
                    input.repo,
                ),
            );
        }),
    getSubscription: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCachedCodebergRepoSubscription(
                    accessToken,
                    input.owner,
                    input.repo,
                    ctx.session.user.id,
                );
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getCachedRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                ctx.session.user.id,
            );
        }),
    setSubscription: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                subscribed: z.boolean(),
                ignored: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
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
                        ctx.session.user.id,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await setRepoSubscription(
                accessToken,
                input.owner,
                input.repo,
                input.subscribed,
                input.ignored,
            );
            await deleteCache(
                repoSubscriptionCacheKey(
                    "gh",
                    ctx.session.user.id,
                    input.owner,
                    input.repo,
                ),
            );
        }),
    deleteSubscription: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                await deleteCodebergRepoSubscription(
                    accessToken,
                    input.owner,
                    input.repo,
                );
                await deleteCache(
                    repoSubscriptionCacheKey(
                        "cb",
                        ctx.session.user.id,
                        input.owner,
                        input.repo,
                    ),
                );
                return;
            }
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await deleteRepoSubscription(accessToken, input.owner, input.repo);
            await deleteCache(
                repoSubscriptionCacheKey(
                    "gh",
                    ctx.session.user.id,
                    input.owner,
                    input.repo,
                ),
            );
        }),
    getAllMyRepos: protectedProcedure.query(async ({ ctx }) => {
        const results: {
            provider: "github" | "codeberg";
            owner: string;
            name: string;
            fullName: string;
        }[] = [];

        const settled = await Promise.allSettled([
            getGitHubToken(ctx.db, ctx.session.user.id).then((token) =>
                getGitHubUserRepos(token),
            ),
            getCodebergToken(ctx.db, ctx.session.user.id).then((token) =>
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
