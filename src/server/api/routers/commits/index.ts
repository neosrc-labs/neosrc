import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { getCommitCombinedStatus, listBranchCommits } from "~/server/codeberg";
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
                ctx.session?.user?.id,
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
                ctx.session?.user?.id,
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
                perPage: z.number().min(1).max(35).default(35),
                author: z.string().optional(),
                pagination: z.discriminatedUnion("provider", [
                    z.object({
                        provider: z.literal("gh"),
                        afterCursor: z.string().optional(),
                        beforeCursor: z.string().optional(),
                    }),
                    z.object({
                        provider: z.literal("cb"),
                        page: z.number().optional().default(1),
                    }),
                ]),
            }),
        )
        .query(async ({ ctx, input }): Promise<ListCommitsResult> => {
            try {
                if (input.provider === "cb") {
                    const accessToken = await getCodebergToken(
                        ctx.db,
                        ctx.session?.user?.id,
                    );

                    const page =
                        input.pagination.provider === "cb"
                            ? input.pagination.page
                            : 1;

                    const { commits, totalCount } = await listBranchCommits(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.branch,
                        {
                            page,
                            limit: input.perPage,
                            author: input.author ?? undefined,
                        },
                    );

                    const statuses = await Promise.all(
                        commits.map((c) =>
                            getCommitCombinedStatus(
                                accessToken,
                                input.owner,
                                input.repo,
                                c.sha,
                            ),
                        ),
                    );

                    const items = commits
                        .map((c, i) => mapCodebergCommit(c, statuses[i]))
                        .filter(
                            (c) =>
                                !input.author ||
                                c.author?.login === input.author,
                        );
                    return {
                        commits: items,
                        totalCount,
                        cursors: null,
                        hasPreviousPage: page > 1,
                        hasNextPage: page * input.perPage < totalCount,
                    };
                }
                const accessToken = await getGitHubToken(
                    ctx.db,
                    ctx.session?.user?.id,
                );

                let authorId: string | undefined;
                if (input.author) {
                    const resolvedId = await resolveUserNodeId(
                        accessToken,
                        input.author,
                    );
                    if (!resolvedId) {
                        return {
                            commits: [],
                            totalCount: 0,
                            cursors: null,
                            hasPreviousPage: false,
                            hasNextPage: false,
                        };
                    }
                    authorId = resolvedId;
                }

                const after =
                    input.pagination.provider === "gh" &&
                    !input.pagination.beforeCursor
                        ? input.pagination.afterCursor
                        : undefined;
                const before =
                    input.pagination.provider === "gh"
                        ? input.pagination.beforeCursor
                        : undefined;

                const result = await getBranchCommitsGraphQL(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.branch,
                    {
                        after: after,
                        before: before,
                        authorId,
                        first: before ? undefined : input.perPage,
                        last: before ? input.perPage : undefined,
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
                    hasPreviousPage: result.pageInfo.hasPreviousPage,
                    hasNextPage: result.pageInfo.hasNextPage,
                };
            } catch (e) {
                if (e instanceof Error && /not found/i.test(e.message)) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: e.message,
                    });
                }
                throw e;
            }
        }),
});
