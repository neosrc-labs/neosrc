import { headers } from "next/headers";
import {
    codebergAccessToken,
    getSession,
    githubAccessToken,
} from "~/server/auth";
import {
    getRepo as getCodebergRepo,
    getRepoCounts as getCodebergRepoCounts,
} from "~/server/codeberg";
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

    const provider = pathname.startsWith("/cb/") ? "cb" : "gh";
    const cleanPath = pathname.replace(/^\/(?:gh|cb)(?=\/)/, "");
    const repoMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? null;
    const repo = repoMatch?.[2] ?? null;

    const currentUserPromise = getCurrentUser(provider).catch(() => null);
    const repoDataPromise = getRepoData(provider, owner, repo).catch(
        () => null,
    );

    return (
        <HeaderClient
            currentUserPromise={currentUserPromise}
            repoDataPromise={repoDataPromise}
            initialOwner={owner}
            initialRepo={repo}
        />
    );
}

async function getCurrentUser(
    provider: "gh" | "cb",
): Promise<{ login: string; avatarUrl: string } | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const login = session.user.name;
    const avatarUrl = session.user.image;
    if (login && avatarUrl) return { login, avatarUrl };

    if (provider === "cb") {
        const token = await codebergAccessToken();
        if (!token) return null;
        const { getUser: getCodebergUser } = await import("~/server/codeberg");
        const user = await getCodebergUser(token);
        if (!user) return null;
        return { login: user.login, avatarUrl: user.avatar_url };
    }

    const token = await githubAccessToken();
    if (!token) return null;
    const ghUser = await getAuthenticatedUser(token);
    return { login: ghUser.login, avatarUrl: ghUser.avatar_url };
}

async function getRepoData(
    provider: "gh" | "cb",
    owner: string | null,
    repo: string | null,
): Promise<HeaderRepoData | null> {
    if (!owner || !repo) return null;

    if (provider === "cb") {
        const token = await codebergAccessToken();
        if (!token) return null;
        const raw = await getCodebergRepo(token, owner, repo);
        if (!raw) return null;
        const counts = await getCodebergRepoCounts(token, owner, repo);
        return {
            hasIssues: raw.has_issues,
            hasWiki: raw.has_wiki,
            hasProjects: raw.has_projects,
            hasDiscussions: false,
            isPrivate: raw.private,
            permissions: { admin: raw.permissions.admin },
            ownerAvatarUrl: raw.owner.avatar_url,
            openIssuesCount: counts.openIssuesCount,
            openPullRequestsCount: counts.openPullRequestsCount,
        };
    }

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
