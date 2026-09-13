import { z } from "zod";

import {
    createTRPCRouter,
    protectedProcedure,
    providerInput,
    providerMutation,
    providerQuery,
} from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import {
    createIssueComment as createCodebergIssueComment,
    getIssue as getCodebergIssue,
    getUser as getCodebergUser,
    listIssueCommentReactions,
    listIssueTimeline,
    searchIssues as searchCodebergIssues,
    updateIssue as updateCodebergIssue,
} from "~/server/codeberg";
import {
    createIssueComment,
    getIssue as getGitHubIssue,
    searchIssues,
    updateIssue,
} from "~/server/github";
import { getIssueTimelineGraphQL } from "~/server/github-graphql";
import { mapCbReaction } from "../mappers";
import type { TimelineResult } from "../timeline";
import { CodebergIssueProvider } from "./codeberg";
import {
    codebergCommentIds,
    mapCodebergTimelineEvents,
} from "./codeberg-timeline";
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

    timeline: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            limit: z.number().min(1).max(100).default(30),
            cursor: z.string().optional(),
        }),
        gh: ({ input, accessToken }): Promise<TimelineResult> =>
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
        cb: async ({ input, accessToken }): Promise<TimelineResult> => {
            const page = Number(input.cursor ?? "1");
            const { items, hasNextPage } = await listIssueTimeline(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                page,
                input.limit,
            );
            const commentIds = codebergCommentIds(items);
            // Forgejo has no batch endpoint; fetch one reactions list per
            // comment on the page (capped by the page limit).
            const [viewer, reactionLists] = await Promise.all([
                getCodebergUser(accessToken),
                Promise.all(
                    commentIds.map((id) =>
                        listIssueCommentReactions(
                            accessToken,
                            input.owner,
                            input.repo,
                            id,
                        ).catch(() => []),
                    ),
                ),
            ]);
            return {
                events: mapCodebergTimelineEvents(items),
                nextCursor: hasNextPage ? String(page + 1) : undefined,
                commentReactions: Object.fromEntries(
                    commentIds.map((id, i) => [
                        `comment:${id}`,
                        (reactionLists[i] ?? []).map(mapCbReaction),
                    ]),
                ),
                currentUserLogin: viewer?.login,
                mergeQueueEntry: null,
            };
        },
    }),

    addComment: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().min(1),
        }),
        gh: async ({ input, accessToken }) => {
            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                input.body,
            );
            return { success: true as const, id: comment.id };
        },
        cb: async ({ input, accessToken }) => {
            const comment = await createCodebergIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                input.body,
            );
            return { success: true as const, id: comment.id };
        },
    }),

    updateTitle: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            title: z.string().min(1),
        }),
        gh: async ({ input, accessToken }) => {
            const result = await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { title: input.title },
            );
            return { success: true as const, title: result.title };
        },
        cb: async ({ input, accessToken }) => {
            const result = await updateCodebergIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { title: input.title },
            );
            return { success: true as const, title: result.title };
        },
    }),

    updateBody: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string(),
        }),
        gh: async ({ input, accessToken }) => {
            const result = await updateIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { body: input.body },
            );
            return { success: true as const, body: result.body };
        },
        cb: async ({ input, accessToken }) => {
            const result = await updateCodebergIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { body: input.body },
            );
            return { success: true as const, body: result.body };
        },
    }),

    close: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        gh: async ({ input, accessToken }) => {
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
        cb: async ({ input, accessToken }) => {
            if (input.body) {
                await createCodebergIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                    input.body,
                );
            }

            // Forgejo ignores state_reason; omit it.
            await updateCodebergIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { state: "closed" },
            );
            return { success: true as const };
        },
    }),

    reopen: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        gh: async ({ input, accessToken }) => {
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
        cb: async ({ input, accessToken }) => {
            if (input.body) {
                await createCodebergIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                    input.body,
                );
            }

            await updateCodebergIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
                { state: "open" },
            );
            return { success: true as const };
        },
    }),
});
