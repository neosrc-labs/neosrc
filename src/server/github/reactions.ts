import { cache } from "react";
import type { GQLPullRequestReactions } from "~/server/github-graphql";
import { createOctokit } from "./client";

export const getPullRequestReactions = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const allReactions = await octokit.paginate(
            octokit.rest.reactions.listForIssue,
            { owner, repo, issue_number: pullNumber, per_page: 100 },
        );
        return allReactions;
    },
);

/**
 * REST fallback for getPullRequestReactionsGraphQL, mirroring its shape:
 * one page of reactions plus the issue-level reactions summary for the
 * per-content totals.
 */
export async function getPullRequestReactionsRest(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<GQLPullRequestReactions> {
    const octokit = createOctokit(accessToken);
    const [reactionsRes, issueRes] = await Promise.all([
        octokit.rest.reactions.listForIssue({
            owner,
            repo,
            issue_number: pullNumber,
            per_page: 100,
        }),
        octokit.rest.issues.get({ owner, repo, issue_number: pullNumber }),
    ]);

    const reactions = reactionsRes.data.map((r) => ({
        id: r.id,
        node_id: r.node_id,
        content: r.content.toLowerCase(),
        created_at: r.created_at,
        user: r.user,
    }));

    const summary = issueRes.data.reactions;
    const counts: GQLPullRequestReactions["counts"] = {
        total_count: summary?.total_count ?? 0,
        "+1": summary?.["+1"] ?? 0,
        "-1": summary?.["-1"] ?? 0,
        laugh: summary?.laugh ?? 0,
        confused: summary?.confused ?? 0,
        heart: summary?.heart ?? 0,
        hooray: summary?.hooray ?? 0,
        rocket: summary?.rocket ?? 0,
        eyes: summary?.eyes ?? 0,
    };

    return { reactions, counts };
}

export const getIssueCommentReactions = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    const allReactions = await octokit.paginate(
        octokit.rest.reactions.listForIssueComment,
        { owner, repo, comment_id: commentId, per_page: 100 },
    );
    return allReactions;
};

export const createIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: content as
            | "+1"
            | "-1"
            | "laugh"
            | "confused"
            | "heart"
            | "hooray"
            | "rocket"
            | "eyes",
    });
    return response.data;
};

export const deleteIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
    });
};

export const getPullRequestReviewCommentReactions = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    const allReactions = await octokit.paginate(
        octokit.rest.reactions.listForPullRequestReviewComment,
        { owner, repo, comment_id: commentId, per_page: 100 },
    );
    return allReactions;
};

export const createPullRequestReviewCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response =
        await octokit.rest.reactions.createForPullRequestReviewComment({
            owner,
            repo,
            comment_id: commentId,
            content: content as
                | "+1"
                | "-1"
                | "laugh"
                | "confused"
                | "heart"
                | "hooray"
                | "rocket"
                | "eyes",
        });
    return response.data;
};

export const deletePullRequestReviewCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForPullRequestComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
    });
};

export const createIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.reactions.createForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        content: content as
            | "+1"
            | "-1"
            | "laugh"
            | "confused"
            | "heart"
            | "hooray"
            | "rocket"
            | "eyes",
    });
    return response.data;
};

export const deleteIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        reaction_id: reactionId,
    });
};
