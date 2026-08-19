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
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
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
    deleteBranchRef,
    deleteIssueComment,
    getCachedPullRequest,
    getMergeAsyncResult,
    getMergeRequirements,
    getPullRequest,
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
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { body: input.body },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, body: result.body };
        }),

    updateTitle: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                title: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { title: input.title },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, title: result.title };
        }),

    addComment: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string().min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, id: comment.id };
        }),

    updateComment: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

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
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

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
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const review = await updatePullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, body: review.body };
        }),

    listLabels: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session?.user?.id,
                );
                return listCodebergLabels(accessToken, input.owner, input.repo);
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return listLabelsForRepo(accessToken, input.owner, input.repo);
        }),

    addLabel: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                label: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await addLabelsToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.label],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeLabel: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                label: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await removeLabelFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.label,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    listAssignees: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session?.user?.id,
                );
                return listCodebergAssignees(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return listRepoAssignees(accessToken, input.owner, input.repo);
        }),

    listRecentAuthors: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session?.user?.id,
                );
                return listCodebergRecentAuthors(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return listRecentIssueAuthors(accessToken, input.owner, input.repo);
        }),

    addAssignee: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                assignee: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await addAssigneesToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeAssignee: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                assignee: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await removeAssigneesFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    listMilestones: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session?.user?.id,
                );
                return listCodebergMilestones(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return listMilestonesForRepo(accessToken, input.owner, input.repo);
        }),

    setMilestone: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                milestone: z.number().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await updateIssueMilestone(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.milestone,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    addReviewer: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewer: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await addReviewersToPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeReviewer: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewer: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await removeReviewersFromPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    approve: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                event: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]),
                body: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const review = await createPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.event,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, id: review.id };
        }),

    markAsDraft: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await markPullRequestAsDraft(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    markReadyForReview: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await markPullRequestAsReady(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    merge: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                mergeMethod: z.enum(["merge", "squash", "rebase"]),
                commitTitle: z.string().optional(),
                commitMessage: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

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

                await deleteCache(
                    prCacheKey(input.owner, input.repo, input.number),
                );
            }

            return { success: true as const };
        }),
    revert: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                title: z.string().optional(),
                body: z.string().optional(),
                draft: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const result = await revertPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.title,
                input.body,
                input.draft,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return {
                success: true as const,
                revertPullRequest: {
                    number: result.number,
                    url: result.url,
                },
            };
        }),

    close: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string().trim().min(1).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            if (input.body) {
                await createIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.body,
                );
            }

            await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { state: "closed" },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    reopen: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string().trim().min(1).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            if (input.body) {
                await createIssueComment(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.body,
                );
            }

            await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { state: "open" },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    deleteBranch: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const pr = await getPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            const headOwner = pr.head.repo?.owner.login ?? input.owner;
            const headRepo = pr.head.repo?.name ?? input.repo;

            await deleteBranchRef(
                accessToken,
                headOwner,
                headRepo,
                pr.head.ref,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            return listPullRequests(
                accessToken,
                input.owner,
                input.repo,
                input.state,
                input.page,
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

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
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .query(async ({ ctx, input }): Promise<ReviewComment2[]> => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
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
