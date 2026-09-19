import "server-only";

import { getLinkedAccount, getSession, isAnonymousToken } from "~/server/auth";
import { db } from "~/server/db";
import { getUserRepoPermission } from "~/server/github";
import {
    getRepoPermissionForUser,
    type RepoPermissionLevel,
} from "~/server/repo-cache";
import type { Provider } from "~/utils/provider-url";
import type { PullRequestPermissionContext } from "./permissions-utils";

/**
 * Viewer permission context for an issue or pull request page. GitHub resolves
 * the viewer's repo permission through the API; Codeberg uses the synced
 * materialized view, since its session carries no API grant.
 */
export async function getIssuePermissionContext({
    provider,
    accessToken,
    owner,
    repo,
    subjectPromise,
    userId,
}: {
    provider: Provider;
    accessToken: string;
    owner: string;
    repo: string;
    subjectPromise: Promise<{
        locked: boolean;
        user?: { login: string } | null;
    }>;
    userId: string | undefined;
}): Promise<PullRequestPermissionContext> {
    const session = await getSession();
    const linkedAccount = session?.user
        ? await getLinkedAccount(
              db,
              session.user.id,
              provider === "gh" ? "github" : "codeberg",
          )
        : undefined;
    const account =
        linkedAccount?.connectionStatus === "active"
            ? linkedAccount
            : undefined;

    if (provider === "cb") {
        const currentUser = account?.username ?? null;
        const [subject, permission] = await Promise.all([
            subjectPromise,
            getRepoPermissionForUser("codeberg", currentUser, owner, repo),
        ]);
        return {
            currentUser,
            repoPermission: mapRepoPermissionLevel(permission),
            isPullRequestLocked: subject.locked,
            isPullRequestAuthor: currentUser === subject.user?.login,
            provider: "cb",
        };
    }

    const currentUser = account?.username;
    if (!currentUser || !userId) {
        const subject = await subjectPromise;
        return {
            currentUser: null,
            repoPermission: null,
            isPullRequestLocked: subject.locked,
            isPullRequestAuthor: false,
            provider: "gh",
        };
    }

    const [subject, userPermission] = await Promise.all([
        subjectPromise,
        resolveGitHubPermissionLevel({
            accessToken,
            username: currentUser,
            owner,
            repo,
            userId,
        }),
    ]);

    return {
        currentUser,
        repoPermission: mapRepoPermissionLevel(userPermission),
        isPullRequestLocked: subject.locked,
        isPullRequestAuthor: currentUser === subject.user?.login,
        provider: "gh",
    };
}

/**
 * GitHub's collaborator endpoint is the authority on the viewer's permission,
 * but it only answers for a token that can read collaborators: the shared
 * anonymous token carries no `repo` scope and answers 403, and a rejected or
 * expired token answers 401. A lookup that fails says nothing about access, so
 * fall back to the synced view, which resolves the viewer's stored grants
 * without calling GitHub.
 */
async function resolveGitHubPermissionLevel({
    accessToken,
    username,
    owner,
    repo,
    userId,
}: {
    accessToken: string;
    username: string;
    owner: string;
    repo: string;
    userId: string;
}): Promise<RepoPermissionLevel | "none" | null> {
    if (!isAnonymousToken(accessToken)) {
        try {
            return await getUserRepoPermission(
                accessToken,
                owner,
                repo,
                username,
                userId,
            );
        } catch {
            // Fall through to the synced view.
        }
    }
    return getRepoPermissionForUser("github", username, owner, repo);
}

function mapRepoPermissionLevel(
    permission: RepoPermissionLevel | "none" | null,
): PullRequestPermissionContext["repoPermission"] {
    switch (permission) {
        case "admin":
            return "admin";
        case "write":
        case "maintain":
            return "write";
        case "triage":
        case "read":
            return "read";
        case "none":
            return "none";
        default:
            return null;
    }
}
