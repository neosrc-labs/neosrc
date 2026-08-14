import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
    getCodebergToken,
    getGitHubToken,
    isAnonymousToken,
} from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import type { db } from "~/server/db";
import { getAuthenticatedUser, getPullRequestReviews } from "~/server/github";

type RouterCtx = {
    db: typeof db;
    session?: { user?: { id?: string | null } | null } | null;
};

/**
 * GitHub token for the request context. Falls back to the shared anonymous
 * token when the viewer is not signed in (the token getter's own behavior).
 */
export async function getGhToken(ctx: RouterCtx): Promise<string> {
    return getGitHubToken(ctx.db, ctx.session?.user?.id);
}

/**
 * Token for the provider chosen by the gh/cb provider switch: Codeberg token
 * when `provider === "cb"`, GitHub token otherwise.
 */
export async function getProviderToken(
    ctx: RouterCtx,
    provider: "gh" | "cb",
): Promise<string> {
    return provider === "cb"
        ? getCodebergToken(ctx.db, ctx.session?.user?.id)
        : getGitHubToken(ctx.db, ctx.session?.user?.id);
}

/** Requires a logged-in session and returns its user id (throws UNAUTHORIZED). */
export function requireUserId(ctx: RouterCtx): string {
    const userId = ctx.session?.user?.id;
    if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return userId;
}

/**
 * Current authenticated user, or null when the request is running against the
 * shared anonymous token (no viewer to attribute actions to).
 */
export async function getCurrentUserOrNull(
    accessToken: string,
): Promise<{ login: string } | null> {
    return isAnonymousToken(accessToken)
        ? null
        : getAuthenticatedUser(accessToken);
}

/** Evicts the cached pull request for (owner, repo, number). */
export async function invalidatePrCache(
    owner: string,
    repo: string,
    number: number,
): Promise<void> {
    await deleteCache(prCacheKey(owner, repo, number));
}

/**
 * Runs a pull-request mutation with the caller's token, then evicts the PR
 * cache so the next page load picks up the change. Returns the shared
 * `{ success: true }` result every PR mutation reports.
 */
export async function runPrMutation(
    ctx: RouterCtx,
    input: { owner: string; repo: string; number: number },
    mutate: (accessToken: string) => Promise<unknown>,
): Promise<{ success: true }> {
    const accessToken = await getGhToken(ctx);
    await mutate(accessToken);
    await invalidatePrCache(input.owner, input.repo, input.number);
    return { success: true as const };
}

/** The current user's pending review on a pull request, if one exists. */
export async function findPendingReview(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
    currentUserLogin: string,
) {
    const reviews = await getPullRequestReviews(
        accessToken,
        owner,
        repo,
        number,
    );
    return reviews.find(
        (r) => r.state === "PENDING" && r.user?.login === currentUserLogin,
    );
}

export const ownerRepoInput = z.object({
    owner: z.string(),
    repo: z.string(),
});

export const providerTargetInput = z.object({
    provider: z.enum(["gh", "cb"]).default("gh"),
    owner: z.string(),
    repo: z.string(),
});

export const prTargetInput = ownerRepoInput.extend({ number: z.number() });

export const prCommentIdInput = ownerRepoInput.extend({
    commentId: z.number(),
});

export const prLabelInput = prTargetInput.extend({ label: z.string() });

export const prAssigneeInput = prTargetInput.extend({ assignee: z.string() });

export const prReviewerInput = prTargetInput.extend({ reviewer: z.string() });

export const reviewEventInput = z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    event: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]),
    body: z.string().optional(),
});

export const searchParamsInput = z.object({
    provider: z.enum(["gh", "cb"]).default("gh"),
    owner: z.string(),
    repo: z.string(),
    query: z.string(),
    page: z.number().optional(),
    after: z.string().optional(),
    first: z.number().optional(),
    sort: z.enum(["created", "updated", "comments"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
});

export const shaTargetInput = ownerRepoInput.extend({ sha: z.string() });
