import {
    addQualifier,
    hasQualifier,
    removeQualifier,
    replaceQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";

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
            applyQuery(
                hasQualifier(list.searchQuery, "label", name)
                    ? removeQualifier(list.searchQuery, "label", name)
                    : addQualifier(list.searchQuery, "label", name),
            );
        },
        onAuthorFilter: (login: string) => {
            applyQuery(
                hasQualifier(list.searchQuery, "author", login)
                    ? removeQualifier(list.searchQuery, "author", login)
                    : replaceQualifier(list.searchQuery, "author", login),
            );
        },
        onAssigneesFilter: (login: string) => {
            applyQuery(
                hasQualifier(list.searchQuery, "assignee", login)
                    ? removeQualifier(list.searchQuery, "assignee", login)
                    : replaceQualifier(list.searchQuery, "assignee", login),
            );
        },
    };
}
