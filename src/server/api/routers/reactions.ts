import { z } from "zod";

import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
    providerInput,
    providerMutation,
    providerQuery,
} from "~/server/api/trpc";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import {
    createIssueCommentReaction as createCodebergIssueCommentReaction,
    createIssueReaction as createCodebergIssueReaction,
    deleteIssueCommentReaction as deleteCodebergIssueCommentReaction,
    deleteIssueReaction as deleteCodebergIssueReaction,
    getUser as getCodebergUser,
    listIssueCommentReactions,
    listIssueReactions,
} from "~/server/codeberg";
import {
    createIssueCommentReaction,
    createIssueReaction,
    createPullRequestReviewCommentReaction,
    deleteIssueCommentReaction,
    deleteIssueReaction,
    deletePullRequestReviewCommentReaction,
    getAuthenticatedUser,
    getIssueCommentReactions,
    getPullRequestReactions,
    getPullRequestReactionsRest,
    getPullRequestReviewCommentReactions,
} from "~/server/github";
import {
    addReaction,
    type GQLPullRequestReactions,
    getIssueReactionsGraphQL,
    getPullRequestReactionsGraphQL,
    getSubjectReactions,
    isOrgRestrictionError,
    removeReaction,
} from "~/server/github-graphql";
import { mapCbReactionCounts } from "./mappers";

// Both providers accept the same eight reaction contents.
const reactionContentSchema = z.enum([
    "+1",
    "-1",
    "laugh",
    "confused",
    "heart",
    "hooray",
    "rocket",
    "eyes",
]);

export const reactionsRouter = createTRPCRouter({
    get: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const currentUser = isAnonymousToken(accessToken)
                ? null
                : await getAuthenticatedUser(accessToken);

            let reactionData: GQLPullRequestReactions;
            try {
                reactionData = await getPullRequestReactionsGraphQL(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                );
            } catch (error) {
                if (!isOrgRestrictionError(error)) throw error;
                reactionData = await getPullRequestReactionsRest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                );
            }

            return {
                reactions: reactionData.reactions,
                currentUserLogin: currentUser?.login,
                counts: reactionData.counts,
            };
        }),

    getForIssue: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            issueNumber: z.number(),
        }),
        gh: async ({ input, accessToken }) => {
            const currentUser = isAnonymousToken(accessToken)
                ? null
                : await getAuthenticatedUser(accessToken);

            let reactionData: GQLPullRequestReactions;
            try {
                reactionData = await getIssueReactionsGraphQL(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                );
            } catch (error) {
                if (!isOrgRestrictionError(error)) throw error;
                reactionData = await getPullRequestReactionsRest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                );
            }

            return {
                reactions: reactionData.reactions,
                currentUserLogin: currentUser?.login,
                counts: reactionData.counts,
            };
        },
        cb: async ({ input, accessToken }) => {
            const [reactions, viewer] = await Promise.all([
                listIssueReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                ),
                getCodebergUser(accessToken),
            ]);
            return {
                reactions: reactions.map((reaction, index) => ({
                    id: index + 1,
                    node_id: "",
                    content: reaction.content,
                    created_at: reaction.created_at,
                    user: reaction.user ? { login: reaction.user.login } : null,
                })),
                currentUserLogin: viewer?.login,
                counts: mapCbReactionCounts(reactions),
            };
        },
    }),

    toggleIssueComment: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            commentId: z.number(),
            content: reactionContentSchema,
        }),
        gh: async ({ input, accessToken }) => {
            const [currentUser, existingReactions] = await Promise.all([
                isAnonymousToken(accessToken)
                    ? null
                    : getAuthenticatedUser(accessToken),
                getIssueCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser?.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deleteIssueCommentReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueCommentReaction(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
            );
            return { action: "added" as const };
        },
        cb: async ({ input, accessToken }) => {
            const viewer = (await getCodebergUser(accessToken))?.login;
            const existingReactions = await listIssueCommentReactions(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
            );

            const existing = existingReactions.find(
                (r) => r.user?.login === viewer && r.content === input.content,
            );

            if (existing) {
                // Forgejo deletes by content, not by reaction id.
                await deleteCodebergIssueCommentReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    input.content,
                );
                return { action: "removed" as const };
            }

            await createCodebergIssueCommentReaction(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
            );
            return { action: "added" as const };
        },
    }),

    togglePullRequestReviewComment: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                content: reactionContentSchema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                isAnonymousToken(accessToken)
                    ? null
                    : getAuthenticatedUser(accessToken),
                getPullRequestReviewCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser?.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deletePullRequestReviewCommentReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createPullRequestReviewCommentReaction(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
            );
            return { action: "added" as const };
        }),

    togglePullRequestReview: protectedMutation
        .input(
            z.object({
                subjectId: z.string(),
                content: reactionContentSchema,
                databaseId: z.number().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                isAnonymousToken(accessToken)
                    ? null
                    : getAuthenticatedUser(accessToken),
                getSubjectReactions(accessToken, input.subjectId),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser?.login &&
                    r.content === input.content,
            );

            if (existing) {
                await removeReaction(
                    accessToken,
                    input.subjectId,
                    input.content,
                );
                return { action: "removed" as const };
            }

            await addReaction(accessToken, input.subjectId, input.content);
            return { action: "added" as const };
        }),

    getForReviewComments: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentIds: z.array(z.number()),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const token = accessToken;

            const results = await Promise.all(
                input.commentIds.map((commentId) =>
                    getPullRequestReviewCommentReactions(
                        token,
                        input.owner,
                        input.repo,
                        commentId,
                    ).catch(() => []),
                ),
            );

            const reactionMap: Record<
                number,
                Awaited<ReturnType<typeof getPullRequestReviewCommentReactions>>
            > = {};
            input.commentIds.forEach((id, i) => {
                reactionMap[id] = results[i] as Awaited<
                    ReturnType<typeof getPullRequestReviewCommentReactions>
                >;
            });

            return reactionMap;
        }),

    toggleIssue: providerMutation({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            content: reactionContentSchema,
        }),
        gh: async ({ input, accessToken }) => {
            const [currentUser, existingReactions] = await Promise.all([
                isAnonymousToken(accessToken)
                    ? null
                    : getAuthenticatedUser(accessToken),
                getPullRequestReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser?.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deleteIssueReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueReaction(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.content,
            );
            return { action: "added" as const };
        },
        cb: async ({ input, accessToken }) => {
            const viewer = (await getCodebergUser(accessToken))?.login;
            const existingReactions = await listIssueReactions(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            const existing = existingReactions.find(
                (r) => r.user?.login === viewer && r.content === input.content,
            );

            if (existing) {
                await deleteCodebergIssueReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.content,
                );
                return { action: "removed" as const };
            }

            await createCodebergIssueReaction(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.content,
            );
            return { action: "added" as const };
        },
    }),
});
