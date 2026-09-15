"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { BranchTab } from "~/server/api/routers/branches/types";
import { api } from "~/trpc/react";
import { branchesHref } from "~/utils/provider-url";
import { BRANCH_TABS, type BranchListConfig } from "./branch-list-config";

/** The branches page reads its tab, search and page from the query string. */
export function useBranchList(args: {
    owner: string;
    repo: string;
    config: BranchListConfig;
}) {
    const { owner, repo, config } = args;
    const searchParams = useSearchParams();
    const router = useRouter();

    const tab: BranchTab =
        BRANCH_TABS.find((entry) => entry.key === searchParams.get("tab"))
            ?.key ?? "overview";
    const query = searchParams.get("query") ?? "";
    const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    const { data, isLoading } = api.branches.list.useQuery({
        provider: config.provider,
        owner,
        repo,
        tab,
        query,
        page,
    });

    const setParams = useCallback(
        (changes: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(changes)) {
                if (value === null) params.delete(key);
                else params.set(key, value);
            }
            // A new tab or search starts over at page 1.
            const resetsPaging = "tab" in changes || "query" in changes;
            if (resetsPaging && !("page" in changes)) params.delete("page");

            const search = params.toString();
            const base = branchesHref(config.provider, owner, repo);
            router.push(search === "" ? base : `${base}?${search}`);
        },
        [config.provider, owner, repo, router, searchParams],
    );

    return { tab, query, page, data, isLoading, setParams };
}
