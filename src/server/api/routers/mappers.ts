import { ALL_REACTIONS, type ReactionContent } from "~/lib/reactions";
import type { CodebergIssue, CodebergReaction } from "~/server/codeberg";
import type {
    IssueGetResponseData,
    PullsGetResponseData,
} from "~/server/github";
import type {
    GQLPullRequestReactions,
    GQLReactionNode,
    GqlIssueSearchItem,
    GqlPrSearchItem,
} from "~/server/github-graphql";
import { domain, repoUrl } from "~/utils/provider-url";
import type {
    IssueDetail,
    IssueMetadata,
    IssueSearchItem,
} from "./issues/types";
import type { PrSearchItem } from "./pulls/types";

type GqlAssignee = { login: string; avatarUrl: string };
type GqlLabel = {
    id: string;
    name: string;
    color: string;
    description: string | null;
};
type GqlAuthor = { login: string; avatarUrl: string; url: string };

type CbAssignee = { login: string; avatar_url: string };
type CbLabel = {
    id: number;
    name: string;
    color: string;
    description: string | null;
};
type CbAuthor = { login: string; avatar_url: string };

export type Assignee = { login: string; avatarUrl: string };
export type Label = {
    id: string;
    name: string;
    color: string;
    description: string | null;
};
export type Author = { login: string; avatarUrl: string; url: string };

export function mapGqlAssignee(a: GqlAssignee): Assignee {
    return { login: a.login, avatarUrl: a.avatarUrl };
}

export function mapGqlLabel(l: GqlLabel): Label {
    return {
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description,
    };
}

export function mapGqlAuthor(a: GqlAuthor | null): Author | null {
    if (!a) return null;
    return { login: a.login, avatarUrl: a.avatarUrl, url: a.url };
}

export function mapRestAssignee(a: CbAssignee): Assignee {
    return { login: a.login, avatarUrl: a.avatar_url };
}

export function mapCbLabel(l: CbLabel): Label {
    return {
        id: String(l.id),
        name: l.name,
        color: l.color,
        description: l.description,
    };
}

export function mapCbAuthor(a: CbAuthor | null): Author | null {
    if (!a) return null;
    return { login: a.login, avatarUrl: a.avatar_url, url: "" };
}

export function nullSafe<T>(arr: T[] | null | undefined): T[] {
    return arr ?? [];
}

export function mapGqlPrSearchItem(item: GqlPrSearchItem): PrSearchItem {
    return {
        id: item.databaseId,
        number: item.number,
        title: item.title,
        state: item.state as PrSearchItem["state"],
        isDraft: item.isDraft,
        createdAt: item.createdAt,
        mergedAt: item.mergedAt,
        author: mapGqlAuthor(item.author),
        labels: item.labels.nodes.map(mapGqlLabel),
        assignees: item.assignees.nodes.map(mapGqlAssignee),
        comments: item.comments.totalCount,
        reviewDecision: item.reviewDecision,
        stack:
            item.stack && item.stackEntry
                ? {
                      size: item.stack.size,
                      position: item.stackEntry.position,
                      number: item.stack.number,
                  }
                : null,
    };
}

export function mapGqlIssueSearchItem(
    item: GqlIssueSearchItem,
): IssueSearchItem {
    return {
        number: item.number,
        title: item.title,
        state: item.state as IssueSearchItem["state"],
        createdAt: item.createdAt,
        closedAt: item.closedAt,
        author: mapGqlAuthor(item.author),
        labels: item.labels.nodes.map(mapGqlLabel),
        assignees: item.assignees.nodes.map(mapGqlAssignee),
        comments: item.comments.totalCount,
    };
}

type GhIssueLabelInput =
    | string
    | {
          id?: number;
          name?: string;
          color?: string | null;
          description?: string | null;
      };

// Labels arrive as plain strings in some list contexts and as partial objects
// in single-item responses; normalize both to the shared Label shape.
function mapGhIssueLabel(label: GhIssueLabelInput): Label[] {
    if (typeof label === "string") {
        return [{ id: "", name: label, color: "ededed", description: null }];
    }
    if (!label.name) return [];
    return [
        {
            id: String(label.id ?? ""),
            name: label.name,
            color: label.color ?? "ededed",
            description: label.description ?? null,
        },
    ];
}

export function mapGitHubIssueDetail(issue: IssueGetResponseData): IssueDetail {
    return {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        state: issue.state === "closed" ? "closed" : "open",
        locked: issue.locked,
        comments: issue.comments,
        createdAt: issue.created_at,
        author: issue.user
            ? {
                  login: issue.user.login,
                  avatarUrl: issue.user.avatar_url,
                  profileUrl: issue.user.html_url,
              }
            : null,
        authorAssociation: issue.author_association ?? null,
        labels: issue.labels.flatMap(mapGhIssueLabel),
        assignees: (issue.assignees ?? []).map(mapRestAssignee),
        milestone: issue.milestone
            ? {
                  id: String(issue.milestone.number),
                  title: issue.milestone.title,
                  htmlUrl: issue.milestone.html_url,
              }
            : null,
    };
}

export function mapPullRequestMetadata(
    pr: PullsGetResponseData,
): IssueMetadata {
    return {
        labels: pr.labels.flatMap(mapGhIssueLabel),
        assignees: (pr.assignees ?? []).map(mapRestAssignee),
        milestone: pr.milestone
            ? {
                  id: String(pr.milestone.number),
                  title: pr.milestone.title,
                  htmlUrl: pr.milestone.html_url,
              }
            : null,
    };
}

export function mapCodebergIssueDetail(
    issue: CodebergIssue,
    owner: string,
    repo: string,
): IssueDetail {
    return {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        locked: false,
        comments: issue.comments ?? 0,
        createdAt: issue.created_at,
        author: issue.user
            ? {
                  login: issue.user.login,
                  avatarUrl: issue.user.avatar_url,
                  profileUrl:
                      issue.user.html_url ||
                      `https://${domain("cb")}/${issue.user.login}`,
              }
            : null,
        authorAssociation: null,
        labels: nullSafe(issue.labels).map(mapCbLabel),
        assignees: nullSafe(issue.assignees).map(mapRestAssignee),
        milestone: issue.milestone
            ? {
                  id: String(issue.milestone.id),
                  title: issue.milestone.title,
                  htmlUrl: `${repoUrl("cb", owner, repo)}/milestone/${issue.milestone.id}`,
              }
            : null,
    };
}

export function mapCbReaction(
    r: CodebergReaction,
    index: number,
): GQLReactionNode {
    // Forgejo reactions carry no id; synthesize one for React keys and
    // optimistic identity. Deletion is by content, so it never leaves here.
    return {
        databaseId: index + 1,
        content: r.content,
        createdAt: r.created_at,
        user: r.user
            ? { login: r.user.login, avatarUrl: r.user.avatar_url }
            : null,
    };
}

export function mapCbReactionCounts(
    reactions: CodebergReaction[],
): GQLPullRequestReactions["counts"] {
    const counts: GQLPullRequestReactions["counts"] = {
        total_count: reactions.length,
        "+1": 0,
        "-1": 0,
        laugh: 0,
        confused: 0,
        heart: 0,
        hooray: 0,
        rocket: 0,
        eyes: 0,
    };
    for (const reaction of reactions) {
        if ((ALL_REACTIONS as readonly string[]).includes(reaction.content)) {
            counts[reaction.content as ReactionContent] += 1;
        }
    }
    return counts;
}
