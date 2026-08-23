import type { db } from "~/server/db";

export type Ctx = {
    db: typeof db;
    session: { user: { id: string } } | null;
};

export interface SearchParams {
    owner: string;
    repo: string;
    query: string;
    page?: number;
    after?: string;
    first?: number;
    sort?: "created" | "updated" | "comments";
    order?: "asc" | "desc";
}

export interface SearchProvider<TResult> {
    search(params: SearchParams & { ctx: Ctx }): Promise<TResult>;
}
