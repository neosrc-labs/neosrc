import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getIssue, type IssueSearchItem, searchIssues } from "~/server/github";
import { searchIssuesWithMetadata } from "~/server/github-graphql";

export const issuesRouter = createTRPCRouter({
    getByNumber: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                issueNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return getIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
            );
        }),
    search: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
                page: z.number().optional(),
                after: z.string().optional(),
                first: z.number().optional(),
                sort: z.enum(["created", "updated", "comments"]).optional(),
                order: z.enum(["asc", "desc"]).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const sortOrder =
                input.sort && input.order
                    ? ` sort:${input.sort}-${input.order}`
                    : "";
            const gqlQuery = `repo:${input.owner}/${input.repo} is:issue ${input.query}${sortOrder}`;

            const restQuery = input.query.replace(
                /^(is:open|is:closed)\s*/,
                "",
            );
            const base = `repo:${input.owner}/${input.repo} is:issue`;
            const countQueries = {
                open: `${base} is:open ${restQuery}${sortOrder}`.trim(),
                closed: `${base} is:closed ${restQuery}${sortOrder}`.trim(),
            };

            const result = await searchIssuesWithMetadata(
                accessToken,
                gqlQuery,
                input.first ?? 30,
                input.after ?? null,
                countQueries,
            );

            return result;
        }),

    searchAutocomplete: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const items: IssueSearchItem[] = await searchIssues(
                accessToken,
                input.owner,
                input.repo,
                input.query,
            );

            return items;
        }),
});
