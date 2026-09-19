import { z } from "zod";

import {
    createTRPCRouter,
    protectedMutation,
    providerInput,
    providerMutation,
    providerQuery,
    viewerProcedure,
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

const REVIEW_COMMENT_REACTION_LIMIT = 100;
const REVIEW_COMMENT_REACTION_CONCURRENCY = 8;

async function getReviewCommentReactionMap({
    accessToken,
    owner,
    repo,
    commentIds,
}: {
    accessToken: string;
    owner: string;
    repo: string;
    commentIds: number[];
}) {
    const uniqueIds = [...new Set(commentIds)];
    const reactionMap: Record<
        number,
        Awaited<ReturnType<typeof getPullRequestReviewCommentReactions>>
    > = {};
    let nextIndex = 0;
    const workers = Array.from(
        {
            length: Math.min(
                REVIEW_COMMENT_REACTION_CONCURRENCY,
                uniqueIds.length,
            ),
        },
        async () => {
            for (;;) {
                const commentId = uniqueIds[nextIndex++];
                if (commentId === undefined) return;
                reactionMap[commentId] =
                    await getPullRequestReviewCommentReactions(
                        accessToken,
                        owner,
                        repo,
                        commentId,
                    ).catch(() => []);
            }
        },
    );
    await Promise.all(workers);
    return reactionMap;
}

export const reactionsRouter = createTRPCRouter({
    get: viewerProcedure
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

    getForReviewComments: viewerProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentIds: z
                    .array(z.number().int().positive())
                    .max(REVIEW_COMMENT_REACTION_LIMIT),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return getReviewCommentReactionMap({
                accessToken,
                owner: input.owner,
                repo: input.repo,
                commentIds: input.commentIds,
            });
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
