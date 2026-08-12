import type { SyncRepo } from "./shared";

/**
 * Provider raw-payload -> SyncRepo mappers, shared between the permission
 * sync (sync/github.ts, sync/codeberg.ts) and the repo-table-backed repo
 * cache (repo-cache.ts). Both paths write the same canonical columns, so the
 * mapping lives in exactly one place.
 */

/** Raw GitHub REST repository payload (repos.get / listForOrg / listForUser). */
export type GitHubRepoRaw = {
    id: number;
    name: string;
    private: boolean;
    description?: string | null;
    stargazers_count?: number;
    // GitHub's watchers_count is a deprecated alias of stargazers_count;
    // subscribers_count is the real "watching" count.
    subscribers_count?: number;
    watchers_count?: number;
    forks_count?: number;
    default_branch?: string;
    archived?: boolean;
    owner: {
        id: number;
        login: string;
        avatar_url?: string | null;
        type?: string;
    };
    permissions?: {
        admin?: boolean;
        maintain?: boolean;
        push?: boolean;
        triage?: boolean;
        pull?: boolean;
    } | null;
};

export function githubRepoToSyncRepo(repo: GitHubRepoRaw): SyncRepo {
    return {
        providerId: repo.id,
        name: repo.name,
        visibility: repo.private ? "private" : "public",
        description: repo.description ?? null,
        stars: repo.stargazers_count ?? 0,
        watchers: repo.subscribers_count ?? repo.watchers_count ?? 0,
        forks: repo.forks_count ?? 0,
        defaultBranch: repo.default_branch ?? null,
        archived: repo.archived ?? false,
        owner: {
            providerId: repo.owner.id,
            login: repo.owner.login,
            avatarUrl: repo.owner.avatar_url ?? null,
            type: repo.owner.type === "Organization" ? "org" : "user",
        },
        permissions: repo.permissions
            ? {
                  admin: repo.permissions.admin ?? false,
                  maintain: repo.permissions.maintain ?? false,
                  push: repo.permissions.push ?? false,
                  triage: repo.permissions.triage ?? false,
                  pull: repo.permissions.pull ?? false,
              }
            : null,
        rawData: repo,
    };
}

/** Raw Forgejo/Codeberg repository payload (single-repo and listing endpoints). */
export type CodebergRepoRaw = {
    id: number;
    name: string;
    private: boolean;
    description: string | null;
    stars_count: number;
    watchers_count: number;
    forks_count: number;
    default_branch: string | null;
    archived: boolean;
    owner: {
        id: number;
        login: string;
        avatar_url?: string | null;
    };
    permissions?: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    } | null;
};

export function codebergRepoToSyncRepo(
    repo: CodebergRepoRaw,
    ownerType: "user" | "org",
): SyncRepo {
    return {
        providerId: repo.id,
        name: repo.name,
        visibility: repo.private ? "private" : "public",
        description: repo.description,
        stars: repo.stars_count,
        watchers: repo.watchers_count,
        forks: repo.forks_count,
        defaultBranch: repo.default_branch,
        archived: repo.archived,
        owner: {
            providerId: repo.owner.id,
            login: repo.owner.login,
            avatarUrl: repo.owner.avatar_url ?? null,
            type: ownerType,
        },
        permissions: repo.permissions
            ? {
                  admin: repo.permissions.admin,
                  maintain: false,
                  push: repo.permissions.push,
                  triage: false,
                  pull: repo.permissions.pull,
              }
            : null,
        rawData: repo,
    };
}
