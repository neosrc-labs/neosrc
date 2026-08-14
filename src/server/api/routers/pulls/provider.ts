import type { SearchParams } from "~/server/api/routers/search-shared";
import type { db } from "~/server/db";
import type { PrSearchResult } from "./types";

export interface PullRequestProvider {
    search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult>;
}

export type Ctx = {
    db: typeof db;
    session: { user: { id: string } } | null;
};
