import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import {
    getCachedRepoHeaderData as getCachedCodebergRepoHeaderData,
    getCachedRepoCounts,
    getUserRepos as getCodebergUserRepos,
} from "~/server/codeberg";
import {
    getCachedRepoIssuePullCounts,
    getUserRepos as getGitHubUserRepos,
    getRepo,
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
