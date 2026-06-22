import type { db } from "~/server/db";
import type { PrSearchResult, SearchParams } from "./types";

export interface PullRequestProvider {
    search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult>;
}

export type Ctx = {
    db: typeof db;
    session: { user: { id: string } };
};
