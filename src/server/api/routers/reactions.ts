import { z } from "zod";

import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import type { db } from "~/server/db";
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
    getPullRequestReactionsGraphQL,
    getSubjectReactions,
    isOrgRestrictionError,
    removeReaction,
} from "~/server/github-graphql";

type ReactionToggleTarget = {
    list: (
        accessToken: string,
        owner: string,
        repo: string,
        id: number,
    ) => Promise<
        Array<{ id: number; user: { login: string } | null; content: string }>
    >;
    remove: (
        accessToken: string,
        owner: string,
        repo: string,
        id: number,
        reactionId: number,
    ) => Promise<void>;
    add: (
        accessToken: string,
        owner: string,
        repo: string,
        id: number,
        content: string,
    ) => Promise<unknown>;
};

/**
 * Shared add/remove toggle for the REST reaction endpoints. The issue,
 * issue-comment and PR-review-comment toggles were three ~45-line copies of
 * this algorithm; only the target API functions differ.
 */
async function toggleReaction(
    ctx: {
        db: typeof db;
        session: { user?: { id: string } | null } | null;
    },
    owner: string,
    repo: string,
    id: number,
    content: string,
    target: ReactionToggleTarget,
): Promise<{ action: "added" | "removed" }> {
    const accessToken = await getGitHubToken(ctx.db, ctx.session?.user?.id);

    const [currentUser, existingReactions] = await Promise.all([
        isAnonymousToken(accessToken)
            ? null
            : getAuthenticatedUser(accessToken),
        target.list(accessToken, owner, repo, id),
    ]);

    const existing = existingReactions.find(
        (r) => r.user?.login === currentUser?.login && r.content === content,
    );

    if (existing) {
        await target.remove(accessToken, owner, repo, id, existing.id);
        return { action: "removed" };
    }

    await target.add(accessToken, owner, repo, id, content);
    return { action: "added" };
}

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

    toggleIssueComment: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) =>
            toggleReaction(
                ctx,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
                {
                    list: getIssueCommentReactions,
                    remove: deleteIssueCommentReaction,
                    add: createIssueCommentReaction,
                },
            ),
        ),

    togglePullRequestReviewComment: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) =>
            toggleReaction(
                ctx,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
                {
                    list: getPullRequestReviewCommentReactions,
                    remove: deletePullRequestReviewCommentReaction,
                    add: createPullRequestReviewCommentReaction,
                },
            ),
        ),

    togglePullRequestReview: protectedMutation
        .input(
            z.object({
                subjectId: z.string(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
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

    toggleIssue: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) =>
            toggleReaction(
                ctx,
                input.owner,
                input.repo,
                input.number,
                input.content,
                {
                    list: getPullRequestReactions,
                    remove: deleteIssueReaction,
                    add: createIssueReaction,
                },
            ),
        ),
});
