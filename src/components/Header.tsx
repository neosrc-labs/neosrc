import { headers } from "next/headers";
import { getSession, githubAccessToken } from "~/server/auth";
import { getAuthenticatedUser, getRepo } from "~/server/github";
import type { HeaderRepoData } from "./HeaderClient";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
    const h = await headers();
    const pathname = h.get("x-pathname") || "/";

    const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? null;
    const repo = repoMatch?.[2] ?? null;

    const [currentUser, repoData] = await Promise.all([
        (async () => {
            try {
                const session = await getSession();
                if (!session?.user) return null;
                const login = session.user.name ?? "";
                const avatarUrl = session.user.image ?? "";
                if (!login || !avatarUrl) {
                    const token = await githubAccessToken();
                    if (!token) return null;
                    const ghUser = await getAuthenticatedUser(token);
                    return {
                        login: ghUser.login,
                        avatarUrl: ghUser.avatar_url,
                    };
                }
                return { login, avatarUrl };
            } catch {
                return null;
            }
        })(),
        (async (): Promise<HeaderRepoData | null> => {
            if (!owner || !repo) return null;
            try {
                const token = await githubAccessToken();
                if (!token) return null;
                const repoInfo = await getRepo(token, owner, repo);
                return {
                    hasIssues: repoInfo.has_issues,
                    hasWiki: repoInfo.has_wiki,
                    hasProjects: repoInfo.has_projects,
                    hasDiscussions: repoInfo.has_discussions,
                    isPrivate: repoInfo.private,
                    permissions: {
                        admin: repoInfo.permissions?.admin ?? false,
                    },
                    ownerAvatarUrl: repoInfo.owner.avatar_url,
                };
            } catch {
                return null;
            }
        })(),
    ]);

    return (
        <HeaderClient
            currentUser={currentUser}
            repoData={repoData}
            initialOwner={owner}
            initialRepo={repo}
        />
    );
}
