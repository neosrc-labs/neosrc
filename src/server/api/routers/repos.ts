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
    getMyRepos: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return getCodebergUserRepos(accessToken);
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            return getGitHubUserRepos(accessToken);
        }),
    getAllMyRepos: protectedProcedure.query(async ({ ctx }) => {
        const results: {
            provider: "github" | "codeberg";
            owner: string;
            name: string;
            fullName: string;
        }[] = [];

        try {
            const ghToken = await getGitHubToken(ctx.db, ctx.session.user.id);
            const ghRepos = await getGitHubUserRepos(ghToken);
            for (const r of ghRepos) {
                results.push({ provider: "github", ...r });
            }
        } catch {
            // GitHub not linked
        }

        try {
            const cbToken = await getCodebergToken(ctx.db, ctx.session.user.id);
            const cbRepos = await getCodebergUserRepos(cbToken);
            for (const r of cbRepos) {
                results.push({ provider: "codeberg", ...r });
            }
        } catch {
            // Codeberg not linked
        }

        return results;
    }),
});
