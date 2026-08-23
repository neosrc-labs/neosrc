import { graphql as octokitGraphql } from "@octokit/graphql";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    buildPrStatusBatchQuery,
    extractMergeStateStatus,
    extractStatusContexts,
    type GqlPrData,
    PR_STATUS_BATCH_SIZE,
    type PrDetailsEntry,
} from "~/server/api/routers/checks";
import {
    createTRPCRouter,
    githubMutation,
    githubQuery,
    protectedMutation,
    protectedProcedure,
    providerInput,
    providerQuery,
} from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
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
    updateBody: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            body: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { body: input.body },
            );
            return { success: true as const, body: result.body };
        },
    }),

    updateTitle: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            title: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                { title: input.title },
            );
            return { success: true as const, title: result.title };
        },
    }),

    addComment: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            body: z.string().min(1),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
            );
            return { success: true as const, id: comment.id };
        },
    }),

    // Comment edits intentionally leave the cached PR payload untouched.
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

    updateReview: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            reviewId: z.number(),
            body: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const review = await updatePullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.body,
            );
            return { success: true as const, body: review.body };
        },
    }),

    listLabels: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            listCodebergLabels(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            listLabelsForRepo(accessToken, input.owner, input.repo),
    }),

    addLabel: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            label: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await addLabelsToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.label],
            );
            return { success: true as const };
        },
    }),

    removeLabel: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            label: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await removeLabelFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.label,
            );
            return { success: true as const };
        },
    }),

    listAssignees: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            listCodebergAssignees(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            listRepoAssignees(accessToken, input.owner, input.repo),
    }),

    listRecentAuthors: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            listCodebergRecentAuthors(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            listRecentIssueAuthors(accessToken, input.owner, input.repo),
    }),

    addAssignee: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            assignee: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await addAssigneesToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );
            return { success: true as const };
        },
    }),

    removeAssignee: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            assignee: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await removeAssigneesFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );
            return { success: true as const };
        },
    }),

    listMilestones: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cb: ({ accessToken, input }) =>
            listCodebergMilestones(accessToken, input.owner, input.repo),
        gh: ({ accessToken, input }) =>
            listMilestonesForRepo(accessToken, input.owner, input.repo),
    }),

    setMilestone: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            milestone: z.number().nullable(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await updateIssueMilestone(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.milestone,
            );
            return { success: true as const };
        },
    }),

    addReviewer: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            reviewer: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await addReviewersToPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );
            return { success: true as const };
        },
    }),

    removeReviewer: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            reviewer: z.string(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await removeReviewersFromPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );
            return { success: true as const };
        },
    }),

    approve: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            event: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]),
            body: z.string().optional(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const review = await createPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.event,
                input.body,
            );
            return { success: true as const, id: review.id };
        },
    }),

    markAsDraft: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await markPullRequestAsDraft(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
            return { success: true as const };
        },
    }),

    markReadyForReview: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            await markPullRequestAsReady(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
            return { success: true as const };
        },
    }),

    merge: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            mergeMethod: z.enum(["merge", "squash", "rebase"]),
            commitTitle: z.string().optional(),
            commitMessage: z.string().optional(),
        }),
        run: async ({ ctx, input, accessToken }) => {
            const pr = await getCachedPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                ctx.session?.user?.id,
            );
            if (!pr.stack) {
                await mergePullRequest(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    input.mergeMethod,
                    input.commitTitle,
                    input.commitMessage,
                );
                return;
            }

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
        },
        // Evict every PR the merge touched: the whole stack when the merge
        // went through the stack path, just this PR otherwise.
        onSuccess: async ({ input, accessToken }) => {
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
                            prCacheKey(input.owner, input.repo, entry.number),
                        ),
                    ),
                );
            } else {
                await deleteCache(
                    prCacheKey(input.owner, input.repo, input.number),
                );
            }
        },
    }),
    revert: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            title: z.string().optional(),
            body: z.string().optional(),
            draft: z.boolean().optional(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
            const result = await revertPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.title,
                input.body,
                input.draft,
            );
            return {
                success: true as const,
                revertPullRequest: {
                    number: result.number,
                    url: result.url,
                },
            };
        },
    }),

    close: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
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
            return { success: true as const };
        },
    }),

    reopen: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            body: z.string().trim().min(1).optional(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
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
            return { success: true as const };
        },
    }),

    deleteBranch: githubMutation({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
        }),
        evictPr: true,
        run: async ({ input, accessToken }) => {
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
            return { success: true as const };
        },
    }),

    list: githubQuery({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            state: z.enum(["open", "closed", "all"]).default("open"),
            page: z.number().optional(),
        }),
        run: ({ input, accessToken }) =>
            listPullRequests(
                accessToken,
                input.owner,
                input.repo,
                input.state,
                input.page,
            ),
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
                prNumbers: z.array(z.number().int().positive()).max(500),
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
            const chunks: number[][] = [];
            for (
                let i = 0;
                i < input.prNumbers.length;
                i += PR_STATUS_BATCH_SIZE
            ) {
                chunks.push(input.prNumbers.slice(i, i + PR_STATUS_BATCH_SIZE));
            }

            const batches = await Promise.all(
                chunks.map(async (chunk) => {
                    const query = buildPrStatusBatchQuery(chunk);
                    const raw = await graphql<Record<string, unknown>>(query, {
                        owner: input.owner,
                        repo: input.repo,
                    });

                    return chunk.reduce<Record<number, PrDetailsEntry>>(
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
            );

            return Object.assign({}, ...batches);
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

    getMergeRequirements: githubQuery({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
        }),
        run: async ({ ctx, input, accessToken }) => {
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
        },
    }),

    listReviews: githubQuery({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
        }),
        run: async ({ input, accessToken }): Promise<ReviewComment2[]> =>
            getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            ),
    }),

    getStack: githubQuery({
        input: z.object({
            owner: z.string(),
            repo: z.string(),
            prNumber: z.number(),
        }),
        run: ({ input, accessToken }) =>
            getPullRequestStack(
                accessToken,
                input.owner,
                input.repo,
                input.prNumber,
            ),
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
