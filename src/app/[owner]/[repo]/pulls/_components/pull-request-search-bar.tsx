"use client";

import { GitPullRequest, Milestone, Search, Tag, X } from "lucide-react";
import {
    detectQualifier,
    SearchAutocomplete,
    type SearchAutocompleteHandle,
} from "~/app/[owner]/[repo]/_components/search/search-autocomplete";
import { splitQuery } from "~/app/[owner]/[repo]/_components/search/search-utils";
import type { PullRequestListConfig } from "./pull-request-list-config";

export function PullRequestSearchBar({
    searchInput,
    setSearchInput,
    cursorPos,
    setCursorPos,
    inputRef,
    searchBarRef,
    autocompleteRef,
    config,
    owner,
    repo,
    onSearch,
    onClear,
    onAutocompleteSelect,
}: {
    searchInput: string;
    setSearchInput: (value: string) => void;
    cursorPos: number;
    setCursorPos: (value: number) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    searchBarRef: React.RefObject<HTMLDivElement | null>;
    autocompleteRef: React.RefObject<SearchAutocompleteHandle | null>;
    config: PullRequestListConfig;
    owner: string;
    repo: string;
    onSearch: () => void;
    onClear: () => void;
    onAutocompleteSelect: (key: string, value: string) => void;
}) {
    const autocompleteMatch = detectQualifier(
        searchInput,
        cursorPos,
        config.qualifiers,
    );

    const urls = config.externalUrls(owner, repo);

    return (
        <div className="border-gray-200 border-b dark:border-zinc-800">
            <div className="flex items-center gap-1 px-4 py-2">
                <div
                    ref={searchBarRef}
                    className="relative flex flex-1 items-center"
                >
                    <div
                        className="pointer-events-none absolute inset-0 flex items-center px-3 py-1.5 text-sm"
                        aria-hidden="true"
                    >
                        {searchInput ? (
                            <span className="whitespace-nowrap">
                                {splitQuery(searchInput).map((seg, i) => {
                                    const key = `${seg.text}-${seg.isQualifier ? "q" : "t"}-${i}`;
                                    return seg.isQualifier ? (
                                        <span
                                            key={key}
                                            className="rounded bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                                        >
                                            {seg.text}
                                        </span>
                                    ) : (
                                        <span
                                            key={key}
                                            className="text-text-primary"
                                        >
                                            {seg.text}
                                        </span>
                                    );
                                })}
                            </span>
                        ) : null}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setCursorPos(e.target.selectionStart ?? 0);
                        }}
                        onKeyDown={(e) => {
                            if (
                                autocompleteMatch &&
                                autocompleteRef.current?.handleKeyDown(e)
                            ) {
                                return;
                            }
                            if (e.key === "Enter" && !e.defaultPrevented) {
                                e.preventDefault();
                                onSearch();
                            }
                        }}
                        onClick={(e) => {
                            setCursorPos(e.currentTarget.selectionStart ?? 0);
                        }}
                        onSelect={(e) => {
                            setCursorPos(e.currentTarget.selectionStart ?? 0);
                        }}
                        placeholder="Search pull requests by title, body, or comments"
                        className="relative w-full rounded-md border border-gray-300 bg-transparent px-3 py-1.5 pr-12 text-sm text-transparent placeholder-gray-500 caret-gray-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:placeholder-zinc-500 dark:caret-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                    {autocompleteMatch && (
                        <SearchAutocomplete
                            ref={autocompleteRef}
                            owner={owner}
                            repo={repo}
                            provider={config.provider}
                            match={autocompleteMatch}
                            query={autocompleteMatch.value}
                            staticOptions={config.autocompleteOptions}
                            onSelect={onAutocompleteSelect}
                            onClose={() => setCursorPos(0)}
                        />
                    )}
                    <div className="absolute right-2 flex items-center gap-0.5">
                        {searchInput && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="flex size-4 cursor-pointer items-center justify-center rounded-full text-text-muted hover:text-text-secondary dark:hover:text-zinc-300"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label="Search"
                            onClick={onSearch}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-secondary dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                        >
                            <Search className="size-4" />
                        </button>
                    </div>
                </div>

                <a
                    href={urls.labels}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                    <Tag className="size-4" />
                    Labels
                </a>

                <a
                    href={urls.milestones}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                    <Milestone className="size-4" />
                    Milestones
                </a>

                <a
                    href={urls.newPr}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-green-600 bg-green-600 px-2.5 py-1.5 font-medium text-sm text-white transition-colors hover:bg-green-700 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-700"
                >
                    <GitPullRequest className="size-4" />
                    New Pull Request
                </a>
            </div>
        </div>
    );
}
