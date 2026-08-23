import type {
    GqlIssueSearchItem,
    GqlPrSearchItem,
} from "~/server/github-graphql";
import type { IssueSearchItem } from "./issues/types";
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

export function mapCbAssignee(a: CbAssignee): Assignee {
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
