import type { db } from "~/server/db";
import type { IssueSearchResult, SearchParams } from "./types";

export interface IssueProvider {
    search(params: SearchParams & { ctx: Ctx }): Promise<IssueSearchResult>;
}

export type Ctx = {
    db: typeof db;
    session: { user: { id: string } };
};

export type ProviderType = "gh" | "cb";
