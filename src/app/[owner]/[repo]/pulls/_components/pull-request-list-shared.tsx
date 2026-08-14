"use client";

import { useMemo } from "react";
import { toggleValueQualifier } from "~/app/[owner]/[repo]/_components/search/search-utils";
import { SearchResultListShell } from "~/app/[owner]/[repo]/_components/search-result-list";
import { useSearchList } from "~/app/[owner]/[repo]/_components/use-search-list";
import type { PrRowData } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { PullRequestRow } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { computeStatusState } from "~/components/ci-status";
import type { PrSearchItem } from "~/server/api/routers/pulls/types";
import { api } from "~/trpc/react";
import { ReviewFilterDropdown, StatusFilterDropdown } from "./filter-dropdowns";
import type {
    FilterState,
    PullRequestListConfig,
} from "./pull-request-list-config";

function normalizeSearchItem(item: PrSearchItem): PrRowData {
    return {
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state === "MERGED" ? "closed" : item.state.toLowerCase(),
        draft: item.isDraft,
        user: item.author
            ? { login: item.author.login, avatar_url: item.author.avatarUrl }
            : null,
        assignee: item.assignees[0]
            ? {
                  login: item.assignees[0].login,
                  avatar_url: item.assignees[0].avatarUrl,
              }
            : null,
        labels: item.labels.map((l) => ({
            id: undefined,
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        created_at: item.createdAt,
        merged_at: item.mergedAt,
        comments_count: item.comments,
        status_state: null,
        status_contexts: [],
        review_decision: item.reviewDecision,
        mergeable: item.mergeable ?? null,
        stack: item.stack,
    };
}

export function PullRequestListShared({
    owner,
    repo,
    defaultState,
    config,
}: {
    owner: string;
    repo: string;
    defaultState: FilterState;
    config: PullRequestListConfig;
}) {
    const utils = api.useUtils();

    const list = useSearchList<PrSearchItem>(
        {
            ...config,
            baseRoute: `${config.basePath}/${owner}/${repo}/pulls`,
            owner,
            repo,
            defaultState,
        },
        {
            useSearchQuery: api.pulls.search.useQuery,
            searchFetch: (args) => utils.pulls.search.fetch(args),
        },
    );

    const prNumbers = useMemo(
        () => list.data?.items.map((i) => i.number) ?? [],
        [list.data],
    );

    const { data: detailsByPr } = api.pulls.listDetailsByPrNumbers.useQuery(
        { owner, repo, prNumbers },
        { enabled: config.fetchStatusChecks && prNumbers.length > 0 },
    );

    const items = useMemo(() => {
        return (list.data?.items ?? []).map((item) => {
            const normalized = normalizeSearchItem(item);
            if (config.fetchStatusChecks) {
                const details = detailsByPr?.[item.number];
                if (details) {
                    normalized.status_contexts = details.statusContexts;
                    normalized.status_state = computeStatusState(
                        details.statusContexts,
                    );
                    normalized.mergeable = details.mergeStateStatus;
                }
            }
            return normalized;
        });
    }, [list.data, detailsByPr, config.fetchStatusChecks]);

    const toggleFilter = (key: string, value: string) => {
        const newQuery = toggleValueQualifier(list.searchQuery, key, value);
        list.setSearchInput(newQuery);
        list.navigate({
            q: newQuery || null,
            page: null,
        });
    };

    return (
        <SearchResultListShell
            config={config}
            owner={owner}
            repo={repo}
            list={list}
            items={items}
            toolbarChildren={
                <>
                    {config.showStatusFilter && (
                        <StatusFilterDropdown
                            currentQuery={list.searchQuery}
                            onToggle={toggleFilter}
                        />
                    )}
                    {config.showReviewFilter && (
                        <ReviewFilterDropdown
                            currentQuery={list.searchQuery}
                            onToggle={toggleFilter}
                        />
                    )}
                </>
            }
            renderRow={(pr, handlers) => (
                <PullRequestRow
                    key={pr.id}
                    provider={config.provider}
                    pr={pr}
                    owner={owner}
                    repo={repo}
                    {...handlers}
                />
            )}
        />
    );
}
