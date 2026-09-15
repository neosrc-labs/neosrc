export type ViewerItemProvider = "gh" | "cb";

/** Rows the home page requests per provider, before merging. */
export const RECENT_ITEM_LIMIT = 5;

/** Open pull request the viewer authored, normalized across providers. */
export interface ViewerPullItem {
    provider: ViewerItemProvider;
    /** `owner/name` on the provider. */
    repo: string;
    number: number;
    title: string;
    isDraft: boolean;
    updatedAt: string;
    comments: number;
}

/** Open issue the viewer authored, normalized across providers. */
export interface ViewerIssueItem {
    provider: ViewerItemProvider;
    /** `owner/name` on the provider. */
    repo: string;
    number: number;
    title: string;
    updatedAt: string;
    comments: number;
}

export interface ViewerItemList<T> {
    items: T[];
    /** Providers whose request failed, so their items are missing. */
    unavailable: ViewerItemProvider[];
}
