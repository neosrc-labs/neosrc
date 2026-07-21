import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import {
    getCachedRepoHeaderData as getCachedCodebergRepoHeaderData,
    getCachedRepoCounts,
    getUserRepos as getCodebergUserRepos,
} from "~/server/codeberg";
import {
    checkRepoStarred,
    deleteRepoSubscription,
    getCachedRepoIssuePullCounts,
    getFileLatestCommits,
    getUserRepos as getGitHubUserRepos,
    getLatestRelease,
    getRepo,
    getRepoBranches,
    getRepoContents,
    getRepoContributors,
    getRepoDeployments,
    getRepoDocFileNames,
    getRepoDocFiles,
    getRepoLanguages,
    getRepoLatestCommit,
    getRepoRefCounts,
    getRepoSubscription,
    getRepoTags,
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
                return getCachedCodebergRepoHeaderData(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const data = await getRepo(accessToken, input.owner, input.repo);

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
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoBranches(accessToken, input.owner, input.repo);
        }),
    getTags: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoTags(accessToken, input.owner, input.repo);
        }),
    getRefCounts: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoRefCounts(accessToken, input.owner, input.repo);
        }),
    getLatestCommit: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
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
    getFileLatestCommits: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                ref: z.string(),
                paths: z.array(z.string()),
            }),
        )
        .query(async ({ ctx, input }) => {
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
                owner: z.string(),
                repo: z.string(),
                path: z.string().optional(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
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
    getDocFileNames: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoDocFileNames(
                accessToken,
                input.owner,
                input.repo,
                input.ref,
            );
        }),
    getRepoLanguages: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoLanguages(accessToken, input.owner, input.repo);
        }),
    getDocFiles: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                ref: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
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
    getContributors: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoContributors(accessToken, input.owner, input.repo);
        }),
    getDeployments: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoDeployments(accessToken, input.owner, input.repo);
        }),
    getLatestRelease: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getLatestRelease(accessToken, input.owner, input.repo);
        }),
    getStarred: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return checkRepoStarred(accessToken, input.owner, input.repo);
        }),
    star: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await starRepo(accessToken, input.owner, input.repo);
        }),
    unstar: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await unstarRepo(accessToken, input.owner, input.repo);
        }),
    getSubscription: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getRepoSubscription(accessToken, input.owner, input.repo);
        }),
    setSubscription: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                subscribed: z.boolean(),
                ignored: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
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
        }),
    deleteSubscription: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            await deleteRepoSubscription(accessToken, input.owner, input.repo);
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
