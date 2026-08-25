import type { RestEndpointMethodTypes } from "@octokit/rest";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
    prCacheKey,
    readCache,
    withStaleWhileRevalidate,
} from "~/server/cache";
import {
    createGraphql,
    disablePullRequestAutoMergeGraphQL,
    enablePullRequestAutoMergeGraphQL,
    getPullRequestStackGraphQL,
    type StackData,
    type StackEntry,
} from "~/server/github-graphql";
import {
    buildStackSuggestion,
    MAX_STACK_SIZE,
    type StackCandidate,
    type StackSuggestion,
} from "~/server/stack-suggestion";
import { getCachedCommit, getCommit } from "./checks";
import { createOctokit } from "./client";

export type {
    StackCandidate,
    StackSuggestion,
} from "~/server/stack-suggestion";
export type PullsGetResponseData =
    RestEndpointMethodTypes["pulls"]["get"]["response"]["data"] & {
        // TODO: This has not yet been added to the RestEndpointMethodTypes upstream yet. Should remove when we update
        stack?: {
            id: number;
            base: { ref: string; sha: string };
            size: number;
            number: number;
            position: number;
        };
    };
export type Label = NonNullable<PullsGetResponseData["labels"]>[number];
export type Reviewer = NonNullable<
    PullsGetResponseData["requested_reviewers"]
>[number];
export type Assignee = NonNullable<PullsGetResponseData["assignees"]>[number];
export type ReviewComment =
    RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
export type ReviewComment2 =
    RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number];
export type CommentForReview =
    RestEndpointMethodTypes["pulls"]["listCommentsForReview"]["response"]["data"][number];
/**
 * Shape shared by listReviewComments and listCommentsForReview items.
 * The Octokit types differ in position/original_position nullability and
 * user nullability, so components that mix both sources consume this.
 */
export type ReviewCommentBase = Omit<
    ReviewComment,
    "position" | "original_position" | "user"
> & {
    position?: number | null;
    original_position?: number | null;
    user: ReviewComment["user"] | null;
};
export type PullRequestFile =
    RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];
export const getPullRequest = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<PullsGetResponseData> => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
        });
        return response.data;
    },
);

export async function getCachedPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    userId?: string | null,
): Promise<PullsGetResponseData> {
    const getOrThrow = async () => {
        try {
            return await getPullRequest(accessToken, owner, repo, pullNumber);
        } catch (error: unknown) {
            if (
                error &&
                typeof error === "object" &&
                "status" in error &&
                (error as { status: number }).status === 404
            ) {
                notFound();
            }
            throw error;
        }
    };

    const permission = userId
        ? await readCache<string>(`permission:${owner}:${repo}:${userId}`)
        : null;

    if (!permission || permission === "none") {
        return getOrThrow();
    }

    return withStaleWhileRevalidate(
        prCacheKey(owner, repo, pullNumber),
        getOrThrow,
        {
            staleAfter: 5 * 1000,
            deleteAfter: 3 * 60 * 1000,
        },
    );
}

export const getPullRequestStack = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        prNumber: number,
    ): Promise<StackData | null> => {
        try {
            return await getPullRequestStackGraphQL(
                accessToken,
                owner,
                repo,
                prNumber,
            );
        } catch {
            // TODO: Properly check the error

            // Currently there is a bug in the Github API where the stack `entries` in the GQL query
            // causes a 500. So for now we fallback to a REST query.
            // https://github.com/orgs/community/discussions/204626
            return await getPullRequestStackREST(
                accessToken,
                owner,
                repo,
                prNumber,
            );
        }
    },
);

// This is a hack due to the Github API having 500 errors in graphql API
async function getPullRequestStackREST(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
): Promise<StackData | null> {
    const octokit = createOctokit(accessToken);
    const pr = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });
    if (pr.status !== 200) {
        return null;
    }

    const prData = pr.data as typeof pr.data & {
        stack?: { id: number; number: number };
    };

    if (!prData.stack) {
        // PR isn't part of a stack
        return null;
    }

    const res = await octokit.request(
        "GET /repos/{owner}/{repo}/stacks/{stack_number}",
        {
            owner,
            repo,
            stack_number: prData.stack.number,
        },
    );
    if (res.status !== 200) {
        return null;
    }

    const stack = res.data as {
        id: number;
        number: number;
        base: { ref: string };
        pull_requests: {
            number: number;
            title: string;
            state: "open" | "closed";
            merged_at: string | null;
            draft: boolean;
            head: { ref: string };
            base: { ref: string };
        }[];
    };

    const toEntryState = (
        entry: (typeof stack.pull_requests)[number],
    ): StackEntry["state"] =>
        entry.merged_at !== null
            ? "merged"
            : entry.state === "open"
              ? "open"
              : "closed";

    const pullRequests: StackEntry[] = stack.pull_requests
        .map((entry, index) => ({
            number: entry.number,
            position: index + 1,
            state: toEntryState(entry),
            draft: entry.draft,
            title: entry.title,
            mergeable: "UNKNOWN" as "CONFLICTING" | "MERGEABLE" | "UNKNOWN",
            headRef: entry.head.ref,
        }))
        .reverse();

    for (const pr of pullRequests) {
        if (pr.state === "open") {
            const fullPr = await getPullRequest(
                accessToken,
                owner,
                repo,
                pr.number,
            );
            pr.mergeable =
                fullPr.mergeable === true
                    ? "MERGEABLE"
                    : fullPr.mergeable === false
                      ? "CONFLICTING"
                      : "UNKNOWN";
        }
    }

    return {
        id: stack.id,
        number: stack.number,
        baseRef: stack.base.ref,
        open: true as const,
        createdAt: "",
        pullRequests,
    };
}

async function findOpenPullRequestByHead(
    accessToken: string,
    owner: string,
    repo: string,
    headRef: string,
): Promise<StackCandidate | null> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        head: `${owner}:${headRef}`,
        per_page: 100,
    });

    for (const pr of response.data) {
        const stack = (pr as { stack?: unknown }).stack;
        if (stack || pr.base.ref === pr.head.ref) {
            continue;
        }
        return {
            number: pr.number,
            title: pr.title,
            state: "open",
            draft: pr.draft ?? false,
            headRef: pr.head.ref,
            baseRef: pr.base.ref,
        };
    }
    return null;
}

/**
 * When the current PR is not yet stacked and its base branch is the head of
 * an open PR (or a chain of them), returns the chain that could be turned
 * into a stack. Mirrors GitHub's recommendation banner: each PR's base
 * branch is the head branch of the PR below it. Capped at
 * {@link MAX_STACK_SIZE} PRs.
 */
export const getStackSuggestion = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<StackSuggestion | null> => {
        const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
        if (pr.state !== "open" || pr.stack) {
            return null;
        }

        return buildStackSuggestion(
            {
                number: pr.number,
                title: pr.title,
                state: pr.state,
                draft: pr.draft ?? false,
                headRef: pr.head.ref,
                baseRef: pr.base.ref,
            },
            (headRef) =>
                findOpenPullRequestByHead(accessToken, owner, repo, headRef),
        );
    },
);

export const listPullRequests = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        state: "open" | "closed" | "all" = "open",
        page: number = 1,
        perPage: number = 30,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.list({
            owner,
            repo,
            state,
            page,
            per_page: perPage,
        });
        return {
            pulls: response.data,
            hasNext: response.data.length >= perPage,
        };
    },
);

export const updatePullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    options: { body?: string; title?: string; state?: "open" | "closed" },
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        ...options,
    });
    return response.data;
};

export const deleteBranchRef = async (
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branch}`,
    });
};

export const doesBranchExist = async (
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
): Promise<boolean> => {
    const octokit = createOctokit(accessToken);
    try {
        await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        return true;
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            error.status === 404
        ) {
            return false;
        }
        throw error;
    }
};

export const markPullRequestAsDraft = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    // For some reason the GitHub REST API just doesn't let you update the status of the PR to draft!?
    // The graphql endpoint does work however.
    const graphql = createGraphql(accessToken);

    const query = `
mutation($pullRequestId: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

    await graphql<{
        convertPullRequestToDraft: {
            pullRequest: { id: string; isDraft: boolean };
        };
    }>(query, { pullRequestId: pr.node_id });

    return pr;
};

export const markPullRequestAsReady = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    const graphql = createGraphql(accessToken);

    const query = `
mutation($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

    await graphql<{
        markPullRequestReadyForReview: {
            pullRequest: { id: string; isDraft: boolean };
        };
    }>(query, { pullRequestId: pr.node_id });

    return pr;
};

export type RevertPullRequestResult = {
    number: number;
    url: string;
};

export const revertPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    title?: string,
    body?: string,
    draft?: boolean,
): Promise<RevertPullRequestResult> => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    const graphql = createGraphql(accessToken);

    const query = `
mutation($input: RevertPullRequestInput!) {
  revertPullRequest(input: $input) {
    revertPullRequest {
      number
      url
    }
  }
}`;

    const result = await graphql<{
        revertPullRequest?: {
            revertPullRequest?: { number: number; url: string } | null;
        } | null;
    }>(query, {
        input: {
            pullRequestId: pr.node_id,
            title: title ?? undefined,
            body: body ?? undefined,
            draft: draft ?? undefined,
        },
    });

    const revertPr = result.revertPullRequest?.revertPullRequest;
    if (!revertPr) {
        throw new Error("Failed to revert pull request: no revert PR returned");
    }

    return {
        number: revertPr.number,
        url: revertPr.url,
    };
};

export type MergeMethod = "merge" | "squash" | "rebase";

export const mergePullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
    commitTitle?: string,
    commitMessage?: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
        commit_title: commitTitle,
        commit_message: commitMessage,
    });
    return response.data;
};

export const mergePullRequestAsync = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
    commitTitle?: string,
    commitMessage?: string,
) => {
    const octokit = createOctokit(accessToken);
    const body: Record<string, unknown> = {
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
    };
    if (commitTitle !== undefined) body.commit_title = commitTitle;
    if (commitMessage !== undefined) body.commit_message = commitMessage;
    const response = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async",
        body,
    );
    return response.data as {
        status: "pending" | "merged" | "enqueued" | "failed";
        details: { message: string; uuid?: string; sha?: string };
    };
};

export type MergeAsyncResult = {
    status: "pending" | "merged" | "enqueued" | "failed";
    details: { message: string; uuid?: string; sha?: string };
};

export const getMergeAsyncResult = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    uuid: string,
): Promise<MergeAsyncResult> => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}",
        { owner, repo, pull_number: pullNumber, uuid },
    );

    return response.data as MergeAsyncResult;
};

const MERGE_METHOD_TO_GQL: Record<MergeMethod, "MERGE" | "SQUASH" | "REBASE"> =
    {
        merge: "MERGE",
        squash: "SQUASH",
        rebase: "REBASE",
    };

export const enableAutoMerge = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });
    return enablePullRequestAutoMergeGraphQL(
        accessToken,
        pr.node_id,
        MERGE_METHOD_TO_GQL[mergeMethod],
    );
};

export const disableAutoMerge = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });
    return disablePullRequestAutoMergeGraphQL(accessToken, pr.node_id);
};

export const unstackPullRequests = async (
    accessToken: string,
    owner: string,
    repo: string,
    stackNumber: number,
): Promise<void> => {
    const octokit = createOctokit(accessToken);
    await octokit.request(
        "POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack",
        {
            owner,
            repo,
            stack_number: stackNumber,
            headers: {
                "X-GitHub-Api-Version": "2026-03-10",
            },
        },
    );
};

export const createPullRequestStack = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullRequests: number[],
): Promise<void> => {
    const octokit = createOctokit(accessToken);
    await octokit.request("POST /repos/{owner}/{repo}/stacks", {
        owner,
        repo,
        pull_requests: pullRequests,
        headers: {
            "X-GitHub-Api-Version": "2026-03-10",
        },
    });
};
export async function* getPullRequestFilesStream(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha?: string,
    userId?: string,
    signal?: AbortSignal,
): AsyncGenerator<PullRequestFile[], void, undefined> {
    if (commitSha) {
        const commit = userId
            ? await getCachedCommit(accessToken, owner, repo, commitSha, userId)
            : await getCommit(accessToken, owner, repo, commitSha);
        yield commit.files ?? [];
    } else {
        const octokit = createOctokit(accessToken);
        for await (const page of octokit.paginate.iterator(
            octokit.pulls.listFiles,
            {
                owner,
                repo,
                pull_number: pullNumber,
                per_page: 30,
                ...(signal ? { request: { signal } } : {}),
            },
        )) {
            yield page.data;
        }
    }
}
export const addReviewersToPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pullNumber,
        reviewers,
    });
    return response.data;
};

export const removeReviewersFromPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.removeRequestedReviewers({
        owner,
        repo,
        pull_number: pullNumber,
        reviewers,
    });
    return response.data;
};
