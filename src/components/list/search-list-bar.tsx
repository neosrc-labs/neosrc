"use client";

import type { ReactNode } from "react";
import { type ListExternalUrls, ListSearchBar } from "./list-search-bar";
import type { SearchListResult } from "./use-search-list";

interface SearchListBarProps<TItem> {
    list: SearchListResult<TItem>;
    provider: "gh" | "cb";
    qualifiers: string[];
    autocompleteOptions: Record<string, { label: string; subtitle?: string }[]>;
    owner: string;
    repo: string;
    placeholder: string;
    urls: ListExternalUrls;
    newItemIcon: ReactNode;
    newItemLabel: string;
    booleanHint?: string | null;
}

export function SearchListBar<TItem>({
    list,
    provider,
    qualifiers,
    autocompleteOptions,
    owner,
    repo,
    placeholder,
    urls,
    newItemIcon,
    newItemLabel,
    booleanHint,
}: SearchListBarProps<TItem>) {
    return (
        <ListSearchBar
            searchInput={list.searchInput}
            setSearchInput={list.setSearchInput}
            cursorPos={list.cursorPos}
            setCursorPos={list.setCursorPos}
            inputRef={list.inputRef}
            searchBarRef={list.searchBarRef}
            autocompleteRef={list.autocompleteRef}
            provider={provider}
            qualifiers={qualifiers}
            autocompleteOptions={autocompleteOptions}
            owner={owner}
            repo={repo}
            placeholder={placeholder}
            urls={urls}
            newItemIcon={newItemIcon}
            newItemLabel={newItemLabel}
            onSearch={list.handleSearch}
            onClear={list.handleClearSearch}
            onAutocompleteSelect={list.handleAutocompleteSelect}
            booleanHint={booleanHint}
        />
    );
}
