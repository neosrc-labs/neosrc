import { mapCodebergStatusContexts } from "~/server/api/routers/mappers";
import {
    getBranches,
    getCachedRepo,
    getCommitCombinedStatus,
    getUserByUsername,
} from "~/server/codeberg";
import { BRANCH_PAGE_SIZE } from "~/server/github";
import { type BranchProvider, branchAuthor } from "./provider";
import { paginateRows, selectTabRows } from "./tabs";
import type { BranchRow } from "./types";

/**
 * Forgejo serves avatars from a content-hash URL the branch listing does not
 * carry, so resolve the page's authors by login.
 */
async function avatarsByLogin(
    accessToken: string,
    rows: BranchRow[],
): Promise<Map<string, string>> {
    const logins = [
        ...new Set(
            rows
                .map((row) => row.author?.login)
                .filter((login): login is string => login != null),
        ),
    ];
    const users = await Promise.all(
        logins.map((login) =>
            getUserByUsername(accessToken, login).catch(() => null),
        ),
    );

    const avatars = new Map<string, string>();
    for (let i = 0; i < logins.length; i++) {
        const login = logins[i];
        const user = users[i];
        if (login !== undefined && user) avatars.set(login, user.avatar_url);
    }
    return avatars;
}

export const codebergBranchProvider: BranchProvider = {
    async list({ accessToken, owner, repo, tab, query, page }) {
        const [{ branches, totalCount: branchTotal }, repoInfo] =
            await Promise.all([
                getBranches(accessToken, owner, repo),
                getCachedRepo(accessToken, owner, repo),
            ]);
        const defaultBranch = repoInfo.default_branch;

        const rows: BranchRow[] = branches.map((branch) => ({
            name: branch.name,
            sha: branch.sha,
            updatedAt: branch.updatedAt,
            author: branchAuthor(
                branch.authorName,
                branch.authorUsername,
                null,
            ),
            isProtected: branch.isProtected,
            pullRequestNumber: null,
            checks: [],
        }));

        const paged = paginateRows(
            selectTabRows(rows, {
                tab,
                query,
                defaultBranch,
                now: Date.now(),
            }),
            page,
            BRANCH_PAGE_SIZE,
        );
        const defaultBranchRow =
            tab === "overview" && defaultBranch
                ? (rows.find((row) => row.name === defaultBranch) ?? null)
                : null;

        // Only the returned page costs a status request. Checks are decoration,
        // so a provider failure on one row must not fail the whole page.
        const pageRows = defaultBranchRow
            ? [...paged.items, defaultBranchRow]
            : paged.items;
        const [statuses, avatars] = await Promise.all([
            Promise.all(
                pageRows.map((row) =>
                    getCommitCombinedStatus(
                        accessToken,
                        owner,
                        repo,
                        row.sha,
                    ).catch(() => null),
                ),
            ),
            avatarsByLogin(accessToken, pageRows),
        ]);

        const enrich = (row: BranchRow, index: number): BranchRow => ({
            ...row,
            author: row.author?.login
                ? {
                      ...row.author,
                      avatarUrl: avatars.get(row.author.login) ?? null,
                  }
                : row.author,
            checks: mapCodebergStatusContexts(statuses[index]),
        });

        return {
            items: paged.items.map(enrich),
            totalCount: paged.totalCount,
            hasNextPage: paged.hasNextPage,
            defaultBranch,
            defaultBranchRow: defaultBranchRow
                ? enrich(defaultBranchRow, pageRows.length - 1)
                : null,
            // Forgejo's listing ignores search and sort, so every branch the
            // walk reached was considered; say so when it stopped short.
            scanLimit:
                branchTotal > branches.length
                    ? { scanned: branches.length, total: branchTotal }
                    : null,
        };
    },
};
