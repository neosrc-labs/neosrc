/**
 * GitHub surfaces its "recent pushes" banner for a branch the signed-in user
 * pushed to within the last hour, as long as the branch still exists, is not
 * the default branch, and has no pull request yet. Both providers expose a
 * repository activity feed with real push timestamps, so the same rule runs
 * against both.
 */
export const RECENT_PUSH_WINDOW_MS = 60 * 60 * 1000;

/** Normalized entry from a provider activity feed. */
export type BranchActivity = {
    /** Short branch name, without the refs/heads/ prefix. */
    branch: string;
    at: string;
    actorLogin: string | null;
    kind: "push" | "delete";
};

export type RecentlyPushedBranch = {
    branch: string;
    pushedAt: string;
    /** Provider URL that opens the new pull request form for the branch. */
    compareUrl: string;
};

/** Strips the refs/heads/ prefix both providers use in activity feeds. */
export function branchFromRef(ref: string | null | undefined): string | null {
    if (!ref) return null;
    const branch = ref.startsWith("refs/heads/")
        ? ref.slice("refs/heads/".length)
        : ref;
    return branch.length > 0 ? branch : null;
}

/** Shape of one `GET /repos/{owner}/{repo}/activity` entry. */
type GitHubActivityLike = {
    ref: string;
    timestamp: string;
    activity_type: string;
    actor: { login: string } | null;
};

/** Shape of one Forgejo `/activities/feeds` entry, already camel-cased. */
type CodebergActivityLike = {
    refName: string | null;
    created: string;
    opType: string;
    actorLogin: string | null;
};

export function fromGitHubActivity(
    entries: GitHubActivityLike[],
): BranchActivity[] {
    return mapActivity(entries, (entry) => ({
        ref: entry.ref,
        at: entry.timestamp,
        actorLogin: entry.actor?.login ?? null,
        kind:
            entry.activity_type === "branch_deletion"
                ? "delete"
                : entry.activity_type === "push" ||
                    entry.activity_type === "force_push" ||
                    entry.activity_type === "branch_creation"
                  ? "push"
                  : null,
    }));
}

export function fromCodebergActivity(
    entries: CodebergActivityLike[],
): BranchActivity[] {
    return mapActivity(entries, (entry) => ({
        ref: entry.refName,
        at: entry.created,
        actorLogin: entry.actorLogin,
        // Forgejo reports a push as commit_repo; tag pushes and pull request
        // events carry no branch the banner could offer.
        kind:
            entry.opType === "delete_branch"
                ? "delete"
                : entry.opType === "commit_repo" ||
                    entry.opType === "create_branch"
                  ? "push"
                  : null,
    }));
}

function mapActivity<T>(
    entries: T[],
    normalize: (entry: T) => {
        ref: string | null;
        at: string;
        actorLogin: string | null;
        kind: BranchActivity["kind"] | null;
    },
): BranchActivity[] {
    const activity: BranchActivity[] = [];
    for (const entry of entries) {
        const { ref, at, actorLogin, kind } = normalize(entry);
        const branch = branchFromRef(ref);
        if (!branch || !kind) continue;
        activity.push({ branch, at, actorLogin, kind });
    }
    return activity;
}

/**
 * Branches the viewer pushed to inside the window, newest push first, with
 * deleted branches and the default branch removed. Returns nothing for
 * anonymous viewers, who have no "your branch".
 */
export function rankRecentPushes(
    activity: BranchActivity[],
    opts: {
        viewerLogin: string | null;
        defaultBranch: string | null;
        now?: number;
    },
): { branch: string; pushedAt: string }[] {
    const { viewerLogin, defaultBranch } = opts;
    if (!viewerLogin) return [];
    const now = opts.now ?? Date.now();

    const deletedAt = new Map<string, number>();
    for (const entry of activity) {
        if (entry.kind !== "delete") continue;
        const ts = Date.parse(entry.at);
        if (Number.isNaN(ts)) continue;
        const previous = deletedAt.get(entry.branch);
        if (previous === undefined || ts > previous) {
            deletedAt.set(entry.branch, ts);
        }
    }

    const newestPush = new Map<string, { pushedAt: string; ts: number }>();
    for (const entry of activity) {
        if (entry.kind !== "push") continue;
        if (entry.actorLogin !== viewerLogin) continue;
        if (entry.branch === defaultBranch) continue;
        const ts = Date.parse(entry.at);
        if (Number.isNaN(ts)) continue;
        // Timestamps ahead of the server clock come from skew, not staleness,
        // so only the lower bound is enforced.
        if (now - ts > RECENT_PUSH_WINDOW_MS) continue;
        const deleted = deletedAt.get(entry.branch);
        if (deleted !== undefined && deleted >= ts) continue;
        const previous = newestPush.get(entry.branch);
        if (previous === undefined || ts > previous.ts) {
            newestPush.set(entry.branch, { pushedAt: entry.at, ts });
        }
    }

    return [...newestPush.entries()]
        .sort(([, a], [, b]) => b.ts - a.ts)
        .map(([branch, { pushedAt }]) => ({ branch, pushedAt }));
}

function encodeRef(ref: string) {
    return ref.split("/").map(encodeURIComponent).join("/");
}

export function githubCompareUrl(
    owner: string,
    repo: string,
    branch: string,
    base: string | null,
) {
    const range = base
        ? `${encodeRef(base)}...${encodeRef(branch)}`
        : encodeRef(branch);
    return `https://github.com/${owner}/${repo}/compare/${range}?expand=1`;
}

export function codebergCompareUrl(
    owner: string,
    repo: string,
    branch: string,
    base: string | null,
) {
    const range = base
        ? `${encodeRef(base)}...${encodeRef(branch)}`
        : encodeRef(branch);
    return `https://codeberg.org/${owner}/${repo}/compare/${range}`;
}

/**
 * The banner is decorative, so provider failures (rate limits, OAuth app
 * restrictions, unreachable hosts) resolve to "no banner" instead of
 * surfacing an error on the pull request list.
 */
export async function bestEffortBanner(
    run: () => Promise<RecentlyPushedBranch | null>,
): Promise<RecentlyPushedBranch | null> {
    try {
        return await run();
    } catch {
        return null;
    }
}

/** Only the newest few candidates are worth a per-branch pull request lookup. */
export const PR_LOOKUP_LIMIT = 3;
