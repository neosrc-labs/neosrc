"use client";

import { useMemo } from "react";
import { SearchResultListShell } from "~/app/[owner]/[repo]/_components/search-result-list";
import { useSearchList } from "~/app/[owner]/[repo]/_components/use-search-list";
import type { IssueSearchItem } from "~/server/api/routers/issues/types";
import { api } from "~/trpc/react";
import { cbIssueConfig, ghIssueConfig } from "./issue-list-config";
import type { IssueRowData } from "./issue-row";
import { IssueRow } from "./issue-row";

function normalizeSearchItem(item: IssueSearchItem): IssueRowData {
    const assigneeNode = item.assignees[0];
    return {
        number: item.number,
        title: item.title,
        state: item.state.toLowerCase(),
        user: item.author
            ? {
                  login: item.author.login,
                  avatar_url: item.author.avatarUrl,
              }
            : null,
        assignee: assigneeNode
            ? {
                  login: assigneeNode.login,
                  avatar_url: assigneeNode.avatarUrl,
              }
            : null,
        labels: item.labels.map((l) => ({
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        created_at: item.createdAt,
        closed_at: item.closedAt,
        comments_count: item.comments,
    };
}

export function IssueList({
    provider = "gh",
    owner,
    repo,
    defaultState,
}: {
    provider?: "gh" | "cb";
    owner: string;
    repo: string;
    defaultState: "open" | "closed";
}) {
    const utils = api.useUtils();
    const config = provider === "cb" ? cbIssueConfig : ghIssueConfig;

    const list = useSearchList<IssueSearchItem>(
        {
            ...config,
            baseRoute: `${config.basePath}/${owner}/${repo}/issues`,
            owner,
            repo,
            defaultState,
        },
        {
            useSearchQuery: api.issues.search.useQuery,
            searchFetch: (args) => utils.issues.search.fetch(args),
        },
    );

    const items = useMemo(
        () => (list.data?.items ?? []).map(normalizeSearchItem),
        [list.data],
    );

    return (
        <SearchResultListShell
            config={config}
            owner={owner}
            repo={repo}
            list={list}
            items={items}
            renderRow={(issue, handlers) => (
                <IssueRow
                    key={issue.number}
                    issue={issue}
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    {...handlers}
                />
            )}
        />
    );
}
