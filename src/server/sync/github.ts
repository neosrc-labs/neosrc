import { graphql as octokitGraphql } from "@octokit/graphql";
import { sql } from "drizzle-orm";

import {
    createOctokit,
    getAuthenticatedUser,
    getGitHubUser,
} from "~/server/github";
import { githubRepoToSyncRepo } from "./mappers";
import * as shared from "./shared";

/**
 * GitHub-flavored sync repo: same canonical shape as shared.SyncRepo; rawData is the
 * raw REST API payload, null when fetched via GraphQL.
 */
export type GitHubSyncRepo = shared.SyncRepo;

export type GitHubOrgMembership = {
    providerId: number;
    login: string;
    avatarUrl: string | null;
    role: "owner" | "member";
};

export type GitHubTeam = {
    providerId: number;
    slug: string;
    name: string;
    org: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
    };
};

export async function fetchOwnerRepos(
    accessToken: string,
    owner: string,
): Promise<shared.OwnerRepos> {
    const profile = await getOwnerProfile(accessToken, owner);
    const repos = await listReposForOwner(accessToken, owner, profile.type);
    return { owner: profile, repos };
}

/**
 * Refreshes the current user's account row, organization/team memberships,
 * and repository grants so mv_user_repo_permissions reflects their current
 * effective permissions. Direct grants always cover the user's own access;
 * team-level grants additionally model the shared team edges.
 *
 * Incremental: the permission snapshot is hashed and compared to the last
 * applied hash; when nothing changed, no rows are written and the
 * materialized view is left alone. When the last applied sync is under
 * `SYNC_RECENCY_WINDOW_MS` old, the inputs are not even fetched.
 * `forceRecent` bypasses only the recency gate, `forceFull` re-syncs
 * unconditionally.
 */
export async function syncCurrentUserGitHub(
    db: shared.Db,
    input: shared.SyncUserInput,
): Promise<shared.SyncResult> {
    const result = shared.newResult();
    const gate = await shared.readSyncState(db, "github", input);
    if (gate.skip) return result;

    // Snapshot ordering token: captured before the provider reads so the guard
    // under the advisory lock can reject a snapshot older than the applied one.
    const snapshotFetchedAt = new Date();

    const profile = await getAuthenticatedUser(input.accessToken);

    // Fetch the snapshot up front; the per-team GraphQL calls and all writes
    // are skipped when the snapshot matches the last applied one.
    const [repos, memberships, teams] = await Promise.all([
        listAuthenticatedUserRepos(input.accessToken),
        listAuthenticatedUserOrgMemberships(input.accessToken),
        listAuthenticatedUserTeams(input.accessToken),
    ]);
    const snapshotHash = githubSnapshotHash(repos, memberships, teams);
    if (!input.forceFull && gate.stored?.snapshotHash === snapshotHash) {
        return result;
    }

    // Team repo grants need one GraphQL call per team; a failing team only
    // skips its shared edges (direct grants above still cover the user).
    // The fan-out is capped: each query costs ~100 rate-limit points, and
    // firing every team at once could exhaust the GraphQL point budget for
    // users in many teams.
    const teamRepos = new Map<number, GitHubSyncRepo[]>();
    const MAX_CONCURRENT_TEAM_FETCHES = 4;
    let nextTeam = 0;
    await Promise.all(
        Array.from(
            { length: Math.min(MAX_CONCURRENT_TEAM_FETCHES, teams.length) },
            async () => {
                while (nextTeam < teams.length) {
                    const team = teams[nextTeam];
                    nextTeam++;
                    if (!team) break; // unreachable while the guard holds
                    try {
                        teamRepos.set(
                            team.providerId,
                            await listTeamRepos(
                                input.accessToken,
                                team.org.login,
                                team.slug,
                            ),
                        );
                    } catch {
                        result.teamsSkipped++;
                    }
                }
            },
        ),
    );

    const relations: shared.RelationRow[] = [];
    const teamIds: number[] = [];
    let didApply = false;

    await db.transaction(async (tx) => {
        // Serialize overlapping syncs for the same user/provider: the
        // delete-then-insert replace below is not idempotent under overlap,
        // and without the lock a stale snapshot could commit last and leave
        // revoked grants visible past the hash gate.
        await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext('github'), hashtext(${input.userId}))`,
        );
        // Refuse to apply a snapshot older than the one already committed under
        // this lock; otherwise an older concurrent sync could restore grants a
        // newer sync just removed.
        const applied = await shared.getStoredSyncState(
            tx,
            "github",
            input.userId,
        );
        if (
            applied?.snapshotFetchedAt &&
            applied.snapshotFetchedAt.getTime() > snapshotFetchedAt.getTime()
        ) {
            return;
        }
        const ctx = shared.createSyncContext(tx, "github", result);
        const userAccountId = await shared.ensureUserAccount(ctx, profile);

        relations.push(
            ...(await shared.collectUserRepoRelations(
                repos,
                userAccountId,
                profile.login,
                (repo) => ctx.ensureRepo(repo),
                githubRepoPermissionsToRelation,
            )),
        );

        for (const membership of memberships) {
            const orgAccountId = await ctx.ensureAccount({
                providerId: membership.providerId,
                login: membership.login,
                avatarUrl: membership.avatarUrl,
                type: "org",
            });
            relations.push({
                resourceType: "org",
                resourceId: orgAccountId,
                relation: membership.role,
                subjectType: "user",
                subjectId: userAccountId,
            });
        }

        for (const team of teams) {
            const orgAccountId = await ctx.ensureAccount({
                providerId: team.org.providerId,
                login: team.org.login,
                avatarUrl: team.org.avatarUrl,
                type: "org",
            });
            teamIds.push(team.providerId);
            relations.push({
                resourceType: "team",
                resourceId: team.providerId,
                relation: "member",
                subjectType: "user",
                subjectId: userAccountId,
            });
            relations.push({
                resourceType: "org",
                resourceId: orgAccountId,
                relation: "member",
                subjectType: "team",
                subjectId: team.providerId,
            });
            for (const repo of teamRepos.get(team.providerId) ?? []) {
                const repoId = await ctx.ensureRepo(repo);
                if (!repo.permissions) continue;
                const relation = githubRepoPermissionsToRelation(
                    repo.permissions,
                );
                if (!relation) continue;
                relations.push({
                    resourceType: "repo",
                    resourceId: repoId,
                    relation,
                    subjectType: "team",
                    subjectId: team.providerId,
                });
            }
        }

        // Replace this user's rows with the freshly fetched state.
        result.relationsRemoved += await shared.deleteRelationsForSubject(
            tx,
            "user",
            [userAccountId],
        );
        if (teamIds.length > 0) {
            result.relationsRemoved += await shared.deleteRelationsForSubject(
                tx,
                "team",
                teamIds,
            );
        }
        result.relationsWritten += await shared.insertRelations(tx, relations);
        // A skipped team means the snapshot is incomplete: leave the state
        // unstored so the next poll re-attempts the team fetches instead of
        // early-returning on the partial hash match.
        if (result.teamsSkipped === 0) {
            await shared.storeSyncState(
                tx,
                "github",
                input.userId,
                snapshotHash,
                snapshotFetchedAt,
            );
        }
        didApply = true;
    });

    if (didApply) await shared.refreshPermissionsView(db);
    return result;
}

/**
 * Order-insensitive signature of the permission snapshot: repo ids with their
 * owner and permission flags, org membership roles, and team identities. Team
 * repo grants are intentionally excluded - a change there also surfaces in the
 * authenticated repo list, which is what trips the signature.
 */
export function githubSnapshotHash(
    repos: GitHubSyncRepo[],
    memberships: GitHubOrgMembership[],
    teams: GitHubTeam[],
): string {
    return shared.hashSnapshot({
        repos: shared.snapshotRepos(repos),
        memberships: memberships
            .map((membership) => ({
                id: membership.providerId,
                role: membership.role,
            }))
            .sort((a, b) => a.id - b.id),
        teams: teams
            .map((team) => ({
                id: team.providerId,
                orgId: team.org.providerId,
            }))
            .sort((a, b) => a.id - b.id),
    });
}

/**
 * All repositories the authenticated user can see (owned, collab, org member),
 * including the effective permission level per repository.
 */
export async function listAuthenticatedUserRepos(
    accessToken: string,
): Promise<GitHubSyncRepo[]> {
    const octokit = createOctokit(accessToken);
    const repos: GitHubSyncRepo[] = [];
    const perPage = 100;
    for (let page = 1; ; page++) {
        const { data } = await octokit.repos.listForAuthenticatedUser({
            affiliations: ["owner", "collaborator", "organization_member"],
            per_page: perPage,
            page,
        });
        for (const repo of data) repos.push(githubRepoToSyncRepo(repo));
        if (data.length < perPage) break;
    }
    return repos;
}

/** Active organization memberships of the authenticated user, with role. */
export async function listAuthenticatedUserOrgMemberships(
    accessToken: string,
): Promise<GitHubOrgMembership[]> {
    const octokit = createOctokit(accessToken);
    const memberships: GitHubOrgMembership[] = [];
    const perPage = 100;
    for (let page = 1; ; page++) {
        const { data } = await octokit.orgs.listMembershipsForAuthenticatedUser(
            { state: "active", per_page: perPage, page },
        );
        for (const m of data) {
            memberships.push({
                providerId: m.organization.id,
                login: m.organization.login,
                avatarUrl: m.organization.avatar_url ?? null,
                role: m.role === "admin" ? "owner" : "member",
            });
        }
        if (data.length < perPage) break;
    }
    return memberships;
}

/** Teams the authenticated user belongs to, with their organization. */
export async function listAuthenticatedUserTeams(
    accessToken: string,
): Promise<GitHubTeam[]> {
    const octokit = createOctokit(accessToken);
    const teams: GitHubTeam[] = [];
    const perPage = 100;
    for (let page = 1; ; page++) {
        const { data } = await octokit.teams.listForAuthenticatedUser({
            per_page: perPage,
            page,
        });
        for (const team of data) {
            if (!team.organization) continue;
            teams.push({
                providerId: team.id,
                slug: team.slug,
                name: team.name,
                org: {
                    providerId: team.organization.id,
                    login: team.organization.login,
                    avatarUrl: team.organization.avatar_url ?? null,
                },
            });
        }
        if (data.length < perPage) break;
    }
    return teams;
}

/**
 * Repositories a team has access to, with the team's permission level on each.
 *
 * The REST endpoints for team repositories return the minimal repository shape
 * (no permissions), so this uses GraphQL's TeamRepositoryEdge.permission.
 */
export async function listTeamRepos(
    accessToken: string,
    org: string,
    teamSlug: string,
): Promise<GitHubSyncRepo[]> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query TeamRepos($org: String!, $teamSlug: String!, $first: Int!, $after: String) {
  viewer {
    organization(login: $org) {
      team(slug: $teamSlug) {
        repositories(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            permission
            node {
              databaseId
              name
              description
              isPrivate
              isArchived
              stargazerCount
              forkCount
              watchers {
                totalCount
              }
              defaultBranchRef {
                name
              }
              owner {
                __typename
                login
                avatarUrl
                ... on User {
                  databaseId
                }
                ... on Organization {
                  databaseId
                }
              }
            }
          }
        }
      }
    }
  }
}`;

    const results: GitHubSyncRepo[] = [];
    let cursor: string | null = null;
    for (;;) {
        // Annotated on the variable (not just the generic) so the response
        // type does not feed back into the cursor-based pagination loop.
        const result: {
            viewer: {
                organization: {
                    team: {
                        repositories: {
                            pageInfo: {
                                hasNextPage: boolean;
                                endCursor: string | null;
                            };
                            edges: Array<{
                                permission:
                                    | "ADMIN"
                                    | "MAINTAIN"
                                    | "WRITE"
                                    | "TRIAGE"
                                    | "READ";
                                node: {
                                    databaseId: number;
                                    name: string;
                                    description: string | null;
                                    isPrivate: boolean;
                                    isArchived: boolean;
                                    stargazerCount: number;
                                    forkCount: number;
                                    watchers: { totalCount: number };
                                    defaultBranchRef: { name: string } | null;
                                    owner: {
                                        __typename: "User" | "Organization";
                                        login: string;
                                        avatarUrl: string | null;
                                        databaseId: number | null;
                                    };
                                };
                            } | null>;
                        };
                    };
                } | null;
            };
        } = await graphql(query, { org, teamSlug, first: 100, after: cursor });

        const team = result.viewer.organization?.team;
        // An org/team the token cannot see would otherwise silently drop that
        // team's repo grants; surface it so the caller counts it as skipped
        // and the sync state is not committed.
        if (!team) {
            throw new Error(`Team ${org}/${teamSlug} not visible to the token`);
        }
        for (const edge of team.repositories.edges) {
            if (!edge?.node) continue;
            // Repos reachable by an org team are owned by the org.
            const owner = edge.node.owner;
            if (owner.databaseId === null) continue;
            results.push({
                providerId: edge.node.databaseId,
                name: edge.node.name,
                visibility: edge.node.isPrivate ? "private" : "public",
                description: edge.node.description,
                stars: edge.node.stargazerCount,
                watchers: edge.node.watchers.totalCount,
                forks: edge.node.forkCount,
                defaultBranch: edge.node.defaultBranchRef?.name ?? null,
                archived: edge.node.isArchived,
                owner: {
                    providerId: owner.databaseId,
                    login: owner.login,
                    avatarUrl: owner.avatarUrl,
                    type: owner.__typename === "User" ? "user" : "org",
                },
                permissions: {
                    admin: edge.permission === "ADMIN",
                    maintain: edge.permission === "MAINTAIN",
                    push: edge.permission === "WRITE",
                    triage: edge.permission === "TRIAGE",
                    pull: edge.permission === "READ",
                },
                rawData: null,
            });
        }
        if (!team.repositories.pageInfo.hasNextPage) break;
        cursor = team.repositories.pageInfo.endCursor;
    }
    return results;
}

/** Profile of a user or organization, used to refresh repos owned by them. */
export async function getOwnerProfile(
    accessToken: string,
    username: string,
): Promise<{
    providerId: number;
    login: string;
    avatarUrl: string | null;
    type: "user" | "org";
}> {
    const user = await getGitHubUser(accessToken, username);
    return {
        providerId: user.id,
        login: user.login,
        avatarUrl: user.avatar_url ?? null,
        type: user.type === "Organization" ? "org" : "user",
    };
}

/** Repositories owned by a user or organization. */
export async function listReposForOwner(
    accessToken: string,
    username: string,
    type: "user" | "org",
): Promise<GitHubSyncRepo[]> {
    const octokit = createOctokit(accessToken);
    const repos: GitHubSyncRepo[] = [];
    const perPage = 100;
    for (let page = 1; ; page++) {
        const { data } =
            type === "org"
                ? await octokit.repos.listForOrg({
                      org: username,
                      type: "all",
                      per_page: perPage,
                      page,
                  })
                : await octokit.repos.listForUser({
                      username,
                      type: "owner",
                      per_page: perPage,
                      page,
                  });
        for (const repo of data) repos.push(githubRepoToSyncRepo(repo));
        if (data.length < perPage) break;
    }
    return repos;
}

/** GitHub permission flags -> relation vocabulary used by the permission view. */
export function githubRepoPermissionsToRelation(
    permissions: shared.RepoPermission,
): "admin" | "maintainer" | "writer" | "triager" | "reader" | null {
    if (permissions.admin) return "admin";
    if (permissions.maintain) return "maintainer";
    if (permissions.push) return "writer";
    if (permissions.triage) return "triager";
    if (permissions.pull) return "reader";
    return null;
}
