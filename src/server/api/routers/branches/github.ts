import {
    BRANCH_PAGE_SIZE,
    type GitHubBranchRef,
    getBranchDetails,
    getBranchProtectionMap,
    getBranchRefs,
    MAX_REF_SCAN_PAGES,
    MAX_REF_WALK_PAGES,
    REF_SCAN_PAGE_SIZE,
} from "~/server/github";
import { type BranchProvider, branchAuthor } from "./provider";
import { paginateRows, selectTabRows } from "./tabs";
import type { BranchListResult, BranchRow } from "./types";

/** The scan only knows the name and head-commit date; details fill the rest. */
function scanRow(ref: { name: string; committedDate: string }): BranchRow {
    return {
        name: ref.name,
        sha: "",
        updatedAt: ref.committedDate,
        author: null,
        isProtected: false,
        pullRequestNumber: null,
        checks: [],
    };
}

function withDetails(
    row: BranchRow,
    detail: GitHubBranchRef | undefined,
    isProtected: boolean,
): BranchRow {
    if (!detail) return { ...row, isProtected };
    return {
        name: row.name,
        sha: detail.oid,
        updatedAt: detail.committedDate || row.updatedAt,
        author: branchAuthor(
            detail.authorName,
            detail.authorLogin,
            detail.authorAvatarUrl,
        ),
        isProtected,
        pullRequestNumber: detail.pullRequestNumber,
        checks: detail.checks,
    };
}

/**
 * GitHub's refs connection returns branches in name order (its only RefOrder
 * value is honoured for tags), so a date tab cannot be computed over the whole
 * list: 2600 branches cost 26 requests. The date tabs therefore classify a
 * sample of both ends of the name order, and report how much of the list they
 * saw so the page can say so. `all` pages the entire list.
 */
export const githubBranchProvider: BranchProvider = {
    async list({ accessToken, owner, repo, tab, query, page }) {
        const scanQuery = query.trim() === "" ? null : query;

        let result: Omit<BranchListResult, "scanLimit">;
        let scanLimit: BranchListResult["scanLimit"] = null;
        if (tab === "all") {
            // The walk covers the requested page: 30 rows per scan page of 100.
            const pages = Math.min(
                MAX_REF_WALK_PAGES,
                Math.ceil((page * BRANCH_PAGE_SIZE) / REF_SCAN_PAGE_SIZE),
            );
            const refsPage = await getBranchRefs(accessToken, owner, repo, {
                query: scanQuery,
                direction: "ASC",
                pages,
            });
            const start = (page - 1) * BRANCH_PAGE_SIZE;
            const items = refsPage.refs
                .slice(start, start + BRANCH_PAGE_SIZE)
                .map(scanRow);
            const walkBound = MAX_REF_WALK_PAGES * REF_SCAN_PAGE_SIZE;
            const clamped =
                refsPage.hasNextPage && pages === MAX_REF_WALK_PAGES;
            const totalCount = clamped ? walkBound : refsPage.totalCount;
            if (clamped) {
                scanLimit = {
                    scanned: refsPage.refs.length,
                    total: refsPage.totalCount,
                };
            }
            result = {
                items,
                totalCount,
                hasNextPage: page * BRANCH_PAGE_SIZE < totalCount,
                defaultBranch: refsPage.defaultBranch,
                defaultBranchRow: null,
            };
        } else {
            const [oldestNames, newestNames] = await Promise.all([
                getBranchRefs(accessToken, owner, repo, {
                    query: scanQuery,
                    direction: "ASC",
                    pages: MAX_REF_SCAN_PAGES,
                }),
                getBranchRefs(accessToken, owner, repo, {
                    query: scanQuery,
                    direction: "DESC",
                    pages: MAX_REF_SCAN_PAGES,
                }),
            ]);
            const seen = new Set<string>();
            const scanRows: BranchRow[] = [];
            for (const ref of [...oldestNames.refs, ...newestNames.refs]) {
                if (seen.has(ref.name)) continue;
                seen.add(ref.name);
                scanRows.push(scanRow(ref));
            }
            const paged = paginateRows(
                selectTabRows(scanRows, {
                    tab,
                    query,
                    defaultBranch: oldestNames.defaultBranch,
                    now: Date.now(),
                }),
                page,
                BRANCH_PAGE_SIZE,
            );
            if (scanRows.length < oldestNames.totalCount) {
                scanLimit = {
                    scanned: scanRows.length,
                    total: oldestNames.totalCount,
                };
            }
            result = {
                items: paged.items,
                totalCount: paged.totalCount,
                hasNextPage: paged.hasNextPage,
                defaultBranch: oldestNames.defaultBranch,
                defaultBranchRow:
                    tab === "overview" && oldestNames.defaultBranch
                        ? (scanRows.find(
                              (row) => row.name === oldestNames.defaultBranch,
                          ) ??
                          scanRow({
                              name: oldestNames.defaultBranch,
                              committedDate: "",
                          }))
                        : null,
            };
        }

        const names = result.items.map((row) => row.name);
        if (result.defaultBranchRow) names.push(result.defaultBranchRow.name);
        if (names.length === 0) return { ...result, scanLimit };

        const [details, protection] = await Promise.all([
            getBranchDetails(accessToken, owner, repo, names),
            getBranchProtectionMap(accessToken, owner, repo, names),
        ]);
        const byName = new Map(details.map((detail) => [detail.name, detail]));

        return {
            ...result,
            scanLimit,
            items: result.items.map((row) =>
                withDetails(
                    row,
                    byName.get(row.name),
                    protection[row.name] === true,
                ),
            ),
            defaultBranchRow: result.defaultBranchRow
                ? withDetails(
                      result.defaultBranchRow,
                      byName.get(result.defaultBranchRow.name),
                      protection[result.defaultBranchRow.name] === true,
                  )
                : null,
        };
    },
};
