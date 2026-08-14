import { graphql as octokitGraphql } from "@octokit/graphql";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    buildPrStatusBatchQuery,
    extractMergeStateStatus,
    extractStatusContexts,
    type GqlPrData,
    type PrDetailsEntry,
} from "~/server/api/routers/checks";
import {
    getGhToken,
    getProviderToken,
    invalidatePrCache,
    prAssigneeInput,
    prCommentIdInput,
    prLabelInput,
    providerTargetInput,
    prReviewerInput,
    prTargetInput,
    reviewEventInput,
    runPrMutation,
    searchParamsInput,
} from "~/server/api/routers/helpers";
import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { deleteCache, prCacheKey, readCache } from "~/server/cache";
import {
    listAssignees as listCodebergAssignees,
    listLabels as listCodebergLabels,
    listMilestones as listCodebergMilestones,
    listRecentIssueAuthors as listCodebergRecentAuthors,
} from "~/server/codeberg";
import {
    addAssigneesToIssue,
    addLabelsToIssue,
    addReviewersToPullRequest,
    createIssueComment,
    createPullRequestReview,
    createPullRequestStack,
    deleteIssueComment,
    getCachedPullRequest,
    getMergeAsyncResult,
    getMergeRequirements,
    getPullRequestReviews,
    getPullRequestStack,
    listLabelsForRepo,
    listMilestonesForRepo,
    listPullRequests,
    listRecentIssueAuthors,
    listRepoAssignees,
    markPullRequestAsDraft,
    markPullRequestAsReady,
    mergePullRequest,
    mergePullRequestAsync,
    type PullsGetResponseData,
    type ReviewComment2,
    removeAssigneesFromIssue,
    removeLabelFromIssue,
    removeReviewersFromPullRequest,
    revertPullRequest,
    unstackPullRequests,
    updateIssueComment,
    updateIssueMilestone,
    updatePullRequest,
    updatePullRequestReview,
} from "~/server/github";
import { getPullRequestHeadShaGraphQL } from "~/server/github-graphql";
import { CodebergPullRequestProvider } from "./codeberg";
import { GitHubPullRequestProvider } from "./github";
import type { Ctx } from "./provider";
import type { PrSearchResult } from "./types";

export const pullsRouter = createTRPCRouter({
    updateBody: protectedMutation
        .input(prTargetInput.extend({ body: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { body: input.body },
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, body: result.body };
        }),

    updateTitle: protectedMutation
        .input(prTargetInput.extend({ title: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { title: input.title },
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, title: result.title };
        }),

    addComment: protectedMutation
        .input(prTargetInput.extend({ body: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, id: comment.id };
        }),

    updateComment: protectedMutation
        .input(prCommentIdInput.extend({ body: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const comment = await updateIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.body,
            );

            return { success: true as const, body: comment.body };
        }),

    deleteComment: protectedMutation
        .input(prCommentIdInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await deleteIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
            );

            return { success: true as const };
        }),

    updateReview: protectedMutation
        .input(
            prTargetInput.extend({
                reviewId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const review = await updatePullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.body,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, body: review.body };
        }),

    listLabels: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? listCodebergLabels(accessToken, input.owner, input.repo)
                : listLabelsForRepo(accessToken, input.owner, input.repo);
        }),

    addLabel: protectedMutation
        .input(prLabelInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                addLabelsToIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    [input.label],
                ),
            ),
        ),

    removeLabel: protectedMutation
        .input(prLabelInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                removeLabelFromIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.label,
                ),
            ),
        ),

    listAssignees: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? listCodebergAssignees(accessToken, input.owner, input.repo)
                : listRepoAssignees(accessToken, input.owner, input.repo);
        }),

    listRecentAuthors: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? listCodebergRecentAuthors(
                      accessToken,
                      input.owner,
                      input.repo,
                  )
                : listRecentIssueAuthors(accessToken, input.owner, input.repo);
        }),

    addAssignee: protectedMutation
        .input(prAssigneeInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                addAssigneesToIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    [input.assignee],
                ),
            ),
        ),

    removeAssignee: protectedMutation
        .input(prAssigneeInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                removeAssigneesFromIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    [input.assignee],
                ),
            ),
        ),

    listMilestones: protectedProcedure
        .input(providerTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);
            return input.provider === "cb"
                ? listCodebergMilestones(accessToken, input.owner, input.repo)
                : listMilestonesForRepo(accessToken, input.owner, input.repo);
        }),

    setMilestone: protectedMutation
        .input(prTargetInput.extend({ milestone: z.number().nullable() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await updateIssueMilestone(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.milestone,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),

    addReviewer: protectedMutation
        .input(prReviewerInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                addReviewersToPullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    [input.reviewer],
                ),
            ),
        ),

    removeReviewer: protectedMutation
        .input(prReviewerInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                removeReviewersFromPullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    [input.reviewer],
                ),
            ),
        ),

    approve: protectedMutation
        .input(reviewEventInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const review = await createPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.event,
                input.body,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, id: review.id };
        }),

    markAsDraft: protectedMutation
        .input(prTargetInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                markPullRequestAsDraft(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
            ),
        ),

    markReadyForReview: protectedMutation
        .input(prTargetInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                markPullRequestAsReady(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
            ),
        ),

    merge: protectedMutation
        .input(
            prTargetInput.extend({
                mergeMethod: z.enum(["merge", "squash", "rebase"]),
                commitTitle: z.string().optional(),
                commitMessage: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const pr = await getCachedPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                ctx.session?.user?.id,
            );
            if (pr.stack) {
                const asyncResult = await mergePullRequestAsync(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.mergeMethod,
                    input.commitTitle,
                    input.commitMessage,
                );
                if (asyncResult.status === "failed") {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: asyncResult.details.message,
                    });
                }

                if (
                    (asyncResult.status === "pending" ||
                        asyncResult.status === "enqueued") &&
                    asyncResult.details.uuid
                ) {
                    let pollResult = asyncResult;
                    const startedAt = Date.now();
                    while (
                        pollResult.status === "pending" ||
                        pollResult.status === "enqueued"
                    ) {
                        if (Date.now() - startedAt > 120_000) {
                            throw new TRPCError({
                                code: "INTERNAL_SERVER_ERROR",
                                message:
                                    "Merge is taking too long. The pull request may still merge in the background.",
                            });
                        }
                        await new Promise<void>((resolve) =>
                            setTimeout(resolve, 1500),
                        );
                        pollResult = await getMergeAsyncResult(
                            accessToken,
                            input.owner,
                            input.repo,
                            input.number,
                            asyncResult.details.uuid,
                        );
                    }
                    if (pollResult.status === "failed") {
                        throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message: pollResult.details.message,
                        });
                    }
                }

                // Evict caches for all PRs in the stack
                const stack = await getPullRequestStack(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                );
                if (stack) {
                    await Promise.all(
                        stack.pullRequests.map((entry) =>
                            deleteCache(
                                prCacheKey(
                                    input.owner,
                                    input.repo,
                                    entry.number,
                                ),
                            ),
                        ),
                    );
                }
            } else {
                await mergePullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.mergeMethod,
                    input.commitTitle,
                    input.commitMessage,
                );

                await invalidatePrCache(input.owner, input.repo, input.number);
            }

            return { success: true as const };
        }),
    revert: protectedMutation
        .input(
            prTargetInput.extend({
                title: z.string().optional(),
                body: z.string().optional(),
                draft: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const result = await revertPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.title,
                input.body,
                input.draft,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return {
                success: true as const,
                revertPullRequest: {
                    number: result.number,
                    url: result.url,
                },
            };
        }),

    close: protectedMutation
        .input(prTargetInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                updatePullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    { state: "closed" },
                ),
            ),
        ),

    reopen: protectedMutation
        .input(prTargetInput)
        .mutation(async ({ ctx, input }) =>
            runPrMutation(ctx, input, (accessToken) =>
                updatePullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    { state: "open" },
                ),
            ),
        ),

    list: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                state: z.enum(["open", "closed", "all"]).default("open"),
                page: z.number().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return listPullRequests(
                accessToken,
                input.owner,
                input.repo,
                input.state,
                input.page,
            );
        }),

    search: protectedProcedure
        .input(searchParamsInput)
        .query(async ({ ctx, input }): Promise<PrSearchResult> => {
            const providerCtx: Ctx = {
                db: ctx.db,
                session: ctx.session,
            };

            const provider =
                input.provider === "cb"
                    ? new CodebergPullRequestProvider()
                    : new GitHubPullRequestProvider();

            return provider.search({
                ...input,
                ctx: providerCtx,
            });
        }),

    listDetailsByPrNumbers: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                prNumbers: z.array(z.number()),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const graphql = octokitGraphql.defaults({
                headers: { authorization: `bearer ${accessToken}` },
            });
            const query = buildPrStatusBatchQuery(input.prNumbers);
            const raw = await graphql<Record<string, unknown>>(query, {
                owner: input.owner,
                repo: input.repo,
            });

            return input.prNumbers.reduce<Record<number, PrDetailsEntry>>(
                (acc, num, i) => {
                    const entry = raw[`pr${i}`] as
                        | { pullRequest?: GqlPrData }
                        | undefined;
                    const pr = entry?.pullRequest;
                    acc[num] = {
                        mergeStateStatus: extractMergeStateStatus(pr),
                        statusContexts: extractStatusContexts(pr),
                    };
                    return acc;
                },
                {},
            );
        }),

    headSha: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const headSha = await getPullRequestHeadShaGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            // When the live head is ahead of the cached PR, drop the cache
            // entry so the next page load fetches fresh PR data.
            const cacheKey = prCacheKey(input.owner, input.repo, input.number);
            const cachedPr = await readCache<PullsGetResponseData>(cacheKey);
            if (headSha && cachedPr && cachedPr.head?.sha !== headSha) {
                await deleteCache(cacheKey);
            }

            return { headSha };
        }),

    getMergeRequirements: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const pr = await getCachedPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                ctx.session?.user?.id,
            );

            return getMergeRequirements(
                accessToken,
                input.owner,
                input.repo,
                pr.base.ref,
            );
        }),

    listReviews: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }): Promise<ReviewComment2[]> => {
            const accessToken = await getGhToken(ctx);
            return getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
        }),

    getStack: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                prNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return getPullRequestStack(
                accessToken,
                input.owner,
                input.repo,
                input.prNumber,
            );
        }),

    createStack: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                pullRequests: z.array(z.number()),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);
            await createPullRequestStack(
                accessToken,
                input.owner,
                input.repo,
                input.pullRequests,
            );
            await Promise.all(
                input.pullRequests.map((number) =>
                    deleteCache(prCacheKey(input.owner, input.repo, number)),
                ),
            );
        }),

    unstack: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                stackNumber: z.number(),
                prNumbers: z.array(z.number()),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);
            await unstackPullRequests(
                accessToken,
                input.owner,
                input.repo,
                input.stackNumber,
            );
            await Promise.all(
                input.prNumbers.map((number) =>
                    deleteCache(prCacheKey(input.owner, input.repo, number)),
                ),
            );
        }),
});
