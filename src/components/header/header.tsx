import { headers } from "next/headers";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    getAuthenticatedUser,
    getCachedRepoHeaderData,
    getCachedRepoIssuePullCounts,
} from "~/server/github";
import type { HeaderRepoData } from "./header-client";
import { HeaderClient } from "./header-client";

export async function Header() {
    const h = await headers();
    const pathname = h.get("x-pathname") || "/";

    const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? null;
    const repo = repoMatch?.[2] ?? null;

    const currentUserPromise = getCurrentUser().catch(() => null);
    const repoDataPromise = getRepoData(owner, repo).catch(() => null);

    return (
        <HeaderClient
            currentUserPromise={currentUserPromise}
            repoDataPromise={repoDataPromise}
            initialOwner={owner}
            initialRepo={repo}
        />
    );
}

async function getCurrentUser(): Promise<{
    login: string;
    avatarUrl: string;
} | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const login = session.user.name;
    const avatarUrl = session.user.image;
    if (!login || !avatarUrl) {
        const token = await githubAccessToken();
        if (!token) return null;
        const ghUser = await getAuthenticatedUser(token);
        return { login: ghUser.login, avatarUrl: ghUser.avatar_url };
    }
    return { login, avatarUrl };
}

async function getRepoData(
    owner: string | null,
    repo: string | null,
): Promise<HeaderRepoData | null> {
    if (!owner || !repo) return null;
    const token = await githubAccessToken();
    if (!token) return null;
    const [headerData, counts] = await Promise.all([
        getCachedRepoHeaderData(token, owner, repo),
        getCachedRepoIssuePullCounts(token, owner, repo),
    ]);
    return {
        ...headerData,
        openIssuesCount: counts.openIssuesCount,
        openPullRequestsCount: counts.openPullRequestsCount,
    };
}
