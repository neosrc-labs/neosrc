import type { SearchParams } from "~/server/api/routers/search-shared";
import type { db } from "~/server/db";
import type { IssueSearchResult } from "./types";

export interface IssueProvider {
    search(params: SearchParams & { ctx: Ctx }): Promise<IssueSearchResult>;
}

export type Ctx = {
    db: typeof db;
    session: { user: { id: string } } | null;
};
