import type { StatusContext } from "~/components/ci-status";
import { createOctokit } from "~/server/github/client";
import { createGraphql } from "~/server/github-graphql";

/** Refs read per cheap scan request. */
export const REF_SCAN_PAGE_SIZE = 100;
/** Rows shown per list page. */
export const BRANCH_PAGE_SIZE = 30;
/** Cheap scans for the overview/active/stale tabs. */
export const MAX_REF_SCAN_PAGES = 3;
/** Hard bound for the `all` walk (2000 refs). */
export const MAX_REF_WALK_PAGES = 20;
/** REST listBranches pages for the shield map (500 branches). */
export const MAX_PROTECTION_SCAN_PAGES = 5;

/** Status contexts requested per branch in the details query. */
const DETAIL_CONTEXT_LIMIT = 50;

export interface GitHubBranchRef {
    name: string;
    oid: string;
    committedDate: string;
    authorName: string;
    authorLogin: string | null;
    authorAvatarUrl: string | null;
    /** Open PR whose head is this branch. */
    pullRequestNumber: number | null;
    checks: StatusContext[];
}

export interface BranchRefPage {
    refs: Array<{ name: string; committedDate: string }>;
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    defaultBranch: string | null;
}

type RefNode = {
    name: string;
    target: { committedDate?: string } | null;
} | null;

interface BranchRefsResponse {
    repository: {
        defaultBranchRef: {
            name: string;
            target: { committedDate?: string } | null;
        } | null;
        refs: {
            totalCount: number;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: RefNode[] | null;
        } | null;
    } | null;
}

type CheckNode = {
    __typename?: string;
    name?: string;
    status?: string;
    conclusion?: string | null;
    detailsUrl?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    context?: string;
    state?: string;
    description?: string | null;
    targetUrl?: string | null;
};

type DetailTarget = {
    oid?: string;
    committedDate?: string;
    author?: {
        name?: string | null;
        avatarUrl?: string | null;
        user?: { login: string } | null;
    } | null;
    statusCheckRollup?: {
        contexts?: { nodes?: Array<CheckNode | null> | null } | null;
    } | null;
    associatedPullRequests?: {
        nodes?: Array<{ number: number; state: string } | null> | null;
    } | null;
};

type DetailNode = { name: string; target: DetailTarget | null } | null;

interface BranchDetailsResponse {
    repository: Record<string, DetailNode> | null;
}

/**
 * Cheap branch scan: names and head-commit dates, ordered by commit date.
 * `after` is only declared when the caller pages, since GraphQL rejects
 * unused variables.
 */
export function buildBranchRefsQuery(includeAfter: boolean): string {
    const afterVar = includeAfter ? ", $after: String" : "";
    const afterArg = includeAfter ? ", after: $after" : "";
    return `query BranchRefs($owner: String!, $repo: String!, $query: String, $first: Int!, $direction: OrderDirection!${afterVar}) {
  repository(owner: $owner, name: $repo) {
    defaultBranchRef { name target { ... on Commit { committedDate } } }
    refs(refPrefix: "refs/heads/", first: $first${afterArg}, query: $query, orderBy: {field: TAG_COMMIT_DATE, direction: $direction}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { name target { ... on Commit { committedDate } } }
    }
  }
}`;
}

/**
 * One alias per branch keeps the detail read to a single round trip per page.
 * Names are JSON-escaped because they are inlined as `qualifiedName` literals.
 */
export function buildBranchDetailsQuery(names: string[]): string {
    const aliases = names
        .map(
            (name, index) => `
    b${index}: ref(qualifiedName: ${JSON.stringify(`refs/heads/${name}`)}) {
      name
      target { ... on Commit {
        oid
        committedDate
        author { name avatarUrl user { login } }
        statusCheckRollup { contexts(first: ${DETAIL_CONTEXT_LIMIT}) { nodes {
          __typename
          ... on CheckRun { name status conclusion detailsUrl startedAt completedAt }
          ... on StatusContext { context state description targetUrl }
        } } }
        associatedPullRequests(first: 3) { nodes { number state } }
      } }
    }`,
        )
        .join("");
    return `query BranchDetails($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {${aliases}
  }
}`;
}

/**
 * Walks the cheap scan for at most `pages` requests, newest or oldest first.
 * An empty `query` reads every branch; a non-empty one is a case-insensitive
 * substring match on the branch name.
 */
export async function getBranchRefs(
    accessToken: string,
    owner: string,
    repo: string,
    opts: {
        query: string | null;
        direction: "ASC" | "DESC";
        pages: number;
        after?: string | null;
    },
): Promise<BranchRefPage> {
    const graphql = createGraphql(accessToken);
    const refs: Array<{ name: string; committedDate: string }> = [];
    let cursor = opts.after ?? null;
    let totalCount = 0;
    let hasNextPage = false;
    let endCursor: string | null = null;
    let defaultBranch: string | null = null;

    for (let page = 0; page < Math.max(1, opts.pages); page++) {
        const variables: Record<string, unknown> = {
            owner,
            repo,
            first: REF_SCAN_PAGE_SIZE,
            query: opts.query,
            direction: opts.direction,
        };
        if (cursor !== null) variables.after = cursor;

        const result = await graphql<BranchRefsResponse>(
            buildBranchRefsQuery(cursor !== null),
            variables,
        );
        const refsPage = result.repository?.refs;
        if (!refsPage) {
            throw new Error(`Repository not found: ${owner}/${repo}`);
        }

        defaultBranch =
            result.repository?.defaultBranchRef?.name ?? defaultBranch;
        totalCount = refsPage.totalCount;
        hasNextPage = refsPage.pageInfo.hasNextPage;
        endCursor = refsPage.pageInfo.endCursor;
        for (const node of refsPage.nodes ?? []) {
            if (!node) continue;
            refs.push({
                name: node.name,
                committedDate: node.target?.committedDate ?? "",
            });
        }

        if (!hasNextPage || endCursor === null) break;
        cursor = endCursor;
    }

    return { refs, totalCount, hasNextPage, endCursor, defaultBranch };
}

function isCheckRunNode(node: CheckNode): boolean {
    return node.__typename === "CheckRun";
}

function toStatusContext(node: CheckNode): StatusContext {
    if (isCheckRunNode(node)) {
        return {
            name: node.name ?? "",
            state: (node.conclusion ?? node.status ?? "").toUpperCase(),
            description: null,
            url: node.detailsUrl ?? null,
            startedAt: node.startedAt ?? null,
            completedAt: node.completedAt ?? null,
        };
    }
    return {
        name: node.context ?? "",
        state: (node.state ?? "").toUpperCase(),
        description: node.description ?? null,
        url: node.targetUrl ?? null,
        startedAt: null,
        completedAt: null,
    };
}

function toBranchRef(
    name: string,
    target: DetailTarget | null,
): GitHubBranchRef {
    const checks: StatusContext[] = [];
    for (const node of target?.statusCheckRollup?.contexts?.nodes ?? []) {
        if (node) checks.push(toStatusContext(node));
    }

    const openPullRequest = (target?.associatedPullRequests?.nodes ?? []).find(
        (node) => node?.state === "OPEN",
    );

    return {
        name,
        oid: target?.oid ?? "",
        committedDate: target?.committedDate ?? "",
        authorName: target?.author?.name ?? "",
        authorLogin: target?.author?.user?.login ?? null,
        authorAvatarUrl: target?.author?.avatarUrl ?? null,
        pullRequestNumber: openPullRequest?.number ?? null,
        checks,
    };
}

/** Commit, author, checks and open PR for up to `BRANCH_PAGE_SIZE` branches. */
export async function getBranchDetails(
    accessToken: string,
    owner: string,
    repo: string,
    names: string[],
): Promise<GitHubBranchRef[]> {
    if (names.length === 0) return [];
    const graphql = createGraphql(accessToken);

    const chunks: string[][] = [];
    for (let i = 0; i < names.length; i += BRANCH_PAGE_SIZE) {
        chunks.push(names.slice(i, i + BRANCH_PAGE_SIZE));
    }

    const pages = await Promise.all(
        chunks.map((chunk) =>
            graphql<BranchDetailsResponse>(buildBranchDetailsQuery(chunk), {
                owner,
                repo,
            }),
        ),
    );

    const refs: GitHubBranchRef[] = [];
    pages.forEach((page, chunkIndex) => {
        const chunk = chunks[chunkIndex] ?? [];
        chunk.forEach((branchName, index) => {
            const node = page.repository?.[`b${index}`];
            if (!node) return;
            refs.push(toBranchRef(branchName, node.target));
        });
    });
    return refs;
}

/**
 * Branch name to protected flag for the names the REST listing reaches.
 * Branch protection rules need `public_repo`/`repo` scope in GraphQL, so the
 * shield falls back to the REST listing. Names past the scan bound are absent.
 */
export async function getBranchProtectionMap(
    accessToken: string,
    owner: string,
    repo: string,
    names: string[],
): Promise<Record<string, boolean>> {
    const wanted = new Set(names);
    const found: Record<string, boolean> = {};
    if (wanted.size === 0) return found;

    const octokit = createOctokit(accessToken);
    for (let page = 1; page <= MAX_PROTECTION_SCAN_PAGES; page++) {
        const res = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: 100,
            page,
        });
        for (const branch of res.data) {
            if (wanted.has(branch.name)) found[branch.name] = branch.protected;
        }
        if (res.data.length < 100) break;
        if ([...wanted].every((name) => name in found)) break;
    }
    return found;
}

export async function deleteRepoBranch(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
}

/** Octokit ships no generated method for the branch rename route. */
export async function renameRepoBranch(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
    newName: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.request(
        "POST /repos/{owner}/{repo}/branches/{branch}/rename",
        { owner, repo, branch, new_name: newName },
    );
}
