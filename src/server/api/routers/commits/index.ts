import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { listBranchCommits } from "~/server/codeberg";
import {
    getBranchCommitsGraphQL,
    getCommitGraphQL,
    getPullRequestCommitsGraphQL,
    resolveUserNodeId,
} from "~/server/github-graphql";
import { mapCodebergCommit, mapGQLCommit } from "./mappers";
import type { ListCommitsResult } from "./types";

export const commitsRouter = createTRPCRouter({
    getBySha: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                sha: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const commit = await getCommitGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.sha,
            );

            return { commit };
        }),

    listForPullRequest: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                perPage: z.number().min(1).max(100).default(30),
                cursor: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await getPullRequestCommitsGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.perPage,
                input.cursor ?? undefined,
            );

            return {
                commits: result.commits,
                nextCursor: result.hasNext ? result.endCursor : undefined,
            };
        }),

    listCommits: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]),
                owner: z.string(),
                repo: z.string(),
                branch: z.string(),
                page: z.number().min(1).default(1),
                perPage: z.number().min(1).max(35).default(35),
                author: z.string().optional(),
                afterCursor: z.string().optional(),
                beforeCursor: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }): Promise<ListCommitsResult> => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                const { commits, totalCount } = await listBranchCommits(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                    {
                        page: input.page,
                        limit: input.perPage,
                        author: input.author ?? undefined,
                    },
                );
                const items = commits
                    .map(mapCodebergCommit)
                    .filter(
                        (c) =>
                            !input.author || c.author?.login === input.author,
                    );
                return { commits: items, totalCount, cursors: null };
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            let authorId: string | undefined;
            if (input.author) {
                const resolvedId = await resolveUserNodeId(
                    accessToken,
                    input.author,
                );
                if (!resolvedId) {
                    return { commits: [], totalCount: 0, cursors: null };
                }
                authorId = resolvedId;
            }

            const result = await getBranchCommitsGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.branch,
                {
                    first: input.beforeCursor ? undefined : input.perPage,
                    last: input.beforeCursor ? input.perPage : undefined,
                    after: input.afterCursor,
                    before: input.beforeCursor,
                    authorId,
                },
            );

            const items = result.commits.map(mapGQLCommit);
            return {
                commits: items,
                totalCount: result.totalCount,
                cursors:
                    result.pageInfo.startCursor && result.pageInfo.endCursor
                        ? {
                              start: result.pageInfo.startCursor,
                              end: result.pageInfo.endCursor,
                          }
                        : null,
            };
        }),
});
