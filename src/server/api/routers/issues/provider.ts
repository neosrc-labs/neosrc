import type { Ctx, SearchProvider } from "../provider";
import type { IssueSearchItem, IssueSearchResult } from "./types";

export interface IssueProvider extends SearchProvider<IssueSearchResult> {
    pinned(params: {
        owner: string;
        repo: string;
        ctx: Ctx;
    }): Promise<IssueSearchItem[]>;
}
