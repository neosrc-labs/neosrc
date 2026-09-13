import { z } from "zod";

import {
    createTRPCRouter,
    githubMutation,
    githubQuery,
    protectedProcedure,
} from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import {
    getIssue as getCodebergIssue,
    searchIssues as searchCodebergIssues,
} from "~/server/codeberg";
import {
    createIssueComment,
    deleteIssueComment,
    getIssue as getGitHubIssue,
    searchIssues,
    updateIssue,
    updateIssueComment,
} from "~/server/github";
import { getIssueTimelineGraphQL } from "~/server/github-graphql";
import type { TimelineResult } from "../timeline";
import { CodebergIssueProvider } from "./codeberg";
import { GitHubIssueProvider } from "./github";
import type { IssueProvider } from "./provider";
import type { IssueSearchResult } from "./types";

export const issuesRouter = createTRPCRouter({
    getByNumber: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                issueNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken =
                input.provider === "cb"
                    ? await getCodebergToken(ctx.db, ctx.session?.user?.id)
                    : await getGitHubToken(ctx.db, ctx.session?.user?.id);

            if (input.provider === "cb") {
                return getCodebergIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                );
            }
            return getGitHubIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
            );
        }),

    search: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
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
        .query(async ({ ctx, input }): Promise<IssueSearchResult> => {
            const provider: IssueProvider =
                input.provider === "cb"
                    ? new CodebergIssueProvider()
                    : new GitHubIssueProvider();

            return await provider.search({
                ...input,
                ctx: { db: ctx.db, session: ctx.session },
            });
        }),

    searchAutocomplete: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken =
                input.provider === "cb"
                    ? await getCodebergToken(ctx.db, ctx.session?.user?.id)
                    : await getGitHubToken(ctx.db, ctx.session?.user?.id);

            if (input.provider === "cb") {
                return searchCodebergIssues(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.query,
                );
            }
            return searchIssues(
                accessToken,
                input.owner,
                input.repo,
                input.query,
            );
        }),

    timeline: githubQuery({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            limit: z.number().min(1).max(100).default(30),
            cursor: z.string().optional(),
        }),
        run: ({ input, accessToken }): Promise<TimelineResult> =>
            getIssueTimelineGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                input.limit,
                input.cursor,
            ).then((r) => ({
                events: r.events,
                nextCursor: r.hasMore ? r.endCursor : undefined,
                commentReactions: r.commentReactions,
                currentUserLogin: r.currentUserLogin,
                mergeQueueEntry: null,
            })),
    }),

    addComment: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().min(1),
        }),
        run: async ({ input, accessToken }) => {
            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                input.body,
            );
            return { success: true as const, id: comment.id };
        },
    }),

    updateComment: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            commentId: z.number(),
            body: z.string(),
        }),
        run: async ({ input, accessToken }) => {
            const comment = await updateIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.body,
            );
            return { success: true as const, body: comment.body };
        },
    }),

    deleteComment: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            commentId: z.number(),
        }),
        run: async ({ input, accessToken }) => {
            await deleteIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
            );
            return { success: true as const };
        },
    }),

    updateTitle: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            title: z.string().min(1),
        }),
        run: async ({ input, accessToken }) => {
            const result = await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { title: input.title },
            );
            return { success: true as const, title: result.title };
        },
    }),

    updateBody: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string(),
        }),
        run: async ({ input, accessToken }) => {
            const result = await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { body: input.body },
            );
            return { success: true as const, body: result.body };
        },
    }),

    close: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        run: async ({ input, accessToken }) => {
            if (input.body) {
                await createIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                    input.body,
                );
            }

            await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                {
                    state: "closed",
                    state_reason: "completed",
                },
            );
            return { success: true as const };
        },
    }),

    reopen: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        run: async ({ input, accessToken }) => {
            if (input.body) {
                await createIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                    input.body,
                );
            }

            await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                {
                    state: "open",
                    state_reason: "reopened",
                },
            );
            return { success: true as const };
        },
    }),
});
