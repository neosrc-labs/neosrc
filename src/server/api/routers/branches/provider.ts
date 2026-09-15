import type { BranchAuthor, BranchListResult, BranchTab } from "./types";

export interface BranchListParams {
    owner: string;
    repo: string;
    tab: BranchTab;
    query: string;
    page: number;
}

export interface BranchProvider {
    list(
        params: BranchListParams & { accessToken: string },
    ): Promise<BranchListResult>;
}

/** A commit author with neither a name nor a login is no author at all. */
export function branchAuthor(
    name: string,
    login: string | null,
    avatarUrl: string | null,
): BranchAuthor | null {
    if (name === "" && login === null) return null;
    return { name, login, avatarUrl };
}
