import { toggleQualifier } from "~/app/[owner]/[repo]/_components/search/search-utils";

interface RowFilterList {
    searchQuery: string;
    setSearchInput: (value: string) => void;
    navigate: (changes: Record<string, string | null>) => void;
}

/** Click-to-filter handlers shared by the issue and pull request rows. */
export function rowQualifierFilters(list: RowFilterList) {
    const applyQuery = (query: string) => {
        list.setSearchInput(query);
        list.navigate({ q: query || null, page: null });
    };

    return {
        onLabelFilter: (name: string) => {
            applyQuery(toggleQualifier(list.searchQuery, "label", name, "add"));
        },
        onAuthorFilter: (login: string) => {
            applyQuery(toggleQualifier(list.searchQuery, "author", login));
        },
        onAssigneesFilter: (login: string) => {
            applyQuery(toggleQualifier(list.searchQuery, "assignee", login));
        },
    };
}
