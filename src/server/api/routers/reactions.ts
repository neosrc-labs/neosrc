import { z } from "zod";
import {
    getCurrentUserOrNull,
    getGhToken,
    prCommentIdInput,
    prTargetInput,
} from "~/server/api/routers/helpers";
import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";

import {
    createIssueCommentReaction,
    createIssueReaction,
    createPullRequestReviewCommentReaction,
    deleteIssueCommentReaction,
    deleteIssueReaction,
    deletePullRequestReviewCommentReaction,
    getIssueCommentReactions,
    getPullRequestReactions,
    getPullRequestReactionsRest,
    getPullRequestReviewCommentReactions,
} from "~/server/github";
import {
    addReaction,
    type GQLPullRequestReactions,
    getPullRequestReactionsGraphQL,
    getSubjectReactions,
    isOrgRestrictionError,
    removeReaction,
} from "~/server/github-graphql";

const reactionContent = z.enum([
    "+1",
    "-1",
    "laugh",
    "confused",
    "heart",
    "hooray",
    "rocket",
    "eyes",
]);

const reactionCommentInput = prCommentIdInput.extend({
    content: reactionContent,
});

type ReactionItem = {
    id?: string | number;
    content: string;
    user?: { login?: string | null } | null;
};

/**
 * Shared toggle flow for all reaction targets: fetch the viewer and the
 * subject's reactions in parallel, remove the matching reaction when it
 * exists, otherwise add it.
 */
async function toggleReaction<T extends ReactionItem>(args: {
    content: string;
    currentUser: Promise<{ login?: string } | null>;
    list: Promise<readonly T[]>;
    remove: (reaction: T) => Promise<unknown>;
    add: () => Promise<unknown>;
}): Promise<{ action: "added" } | { action: "removed" }> {
    const [currentUser, existingReactions] = await Promise.all([
        args.currentUser,
        args.list,
    ]);

    const existing = existingReactions.find(
        (r) =>
            r.user?.login === currentUser?.login && r.content === args.content,
    );

    if (existing) {
        await args.remove(existing);
        return { action: "removed" as const };
    }

    await args.add();
    return { action: "added" as const };
}

export const reactionsRouter = createTRPCRouter({
    get: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const currentUser = await getCurrentUserOrNull(accessToken);

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

    toggleIssueComment: protectedMutation
        .input(reactionCommentInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return toggleReaction({
                content: input.content,
                currentUser: getCurrentUserOrNull(accessToken),
                list: getIssueCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
                remove: (existing) =>
                    deleteIssueCommentReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.commentId,
                        existing.id as number,
                    ),
                add: () =>
                    createIssueCommentReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.commentId,
                        input.content,
                    ),
            });
        }),

    togglePullRequestReviewComment: protectedMutation
        .input(reactionCommentInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return toggleReaction({
                content: input.content,
                currentUser: getCurrentUserOrNull(accessToken),
                list: getPullRequestReviewCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
                remove: (existing) =>
                    deletePullRequestReviewCommentReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.commentId,
                        existing.id as number,
                    ),
                add: () =>
                    createPullRequestReviewCommentReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.commentId,
                        input.content,
                    ),
            });
        }),

    togglePullRequestReview: protectedMutation
        .input(
            z.object({
                subjectId: z.string(),
                content: reactionContent,
                databaseId: z.number().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return toggleReaction({
                content: input.content,
                currentUser: getCurrentUserOrNull(accessToken),
                list: getSubjectReactions(accessToken, input.subjectId),
                remove: () =>
                    removeReaction(accessToken, input.subjectId, input.content),
                add: () =>
                    addReaction(accessToken, input.subjectId, input.content),
            });
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
            const accessToken = await getGhToken(ctx);

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

    toggleIssue: protectedMutation
        .input(prTargetInput.extend({ content: reactionContent }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return toggleReaction({
                content: input.content,
                currentUser: getCurrentUserOrNull(accessToken),
                list: getPullRequestReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
                remove: (existing) =>
                    deleteIssueReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.number,
                        existing.id as number,
                    ),
                add: () =>
                    createIssueReaction(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.number,
                        input.content,
                    ),
            });
        }),
});
