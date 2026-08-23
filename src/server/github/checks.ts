import type { RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";
import { readCache, withStaleWhileRevalidate } from "~/server/cache";
import {
    type GqlCommitChecks,
    getCommitChecksGraphQL,
    isOrgRestrictionError,
} from "~/server/github-graphql";
import {
    deduplicateCommitStatuses,
    mapStatusToCheckRun,
} from "~/utils/status-checks";
import { createOctokit } from "./client";

export type CommitData =
    RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];
export type CheckRun = {
    name: string;
    conclusion: string | null;
    status: string;
    description?: string | null;
    html_url?: string;
    details_url?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    app?: {
        name: string;
        owner?: {
            avatar_url: string;
        } | null;
    } | null;
    creator?: {
        login: string;
        avatar_url: string;
        html_url?: string;
    } | null;
};
export const getChecksForCommit = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ): Promise<CheckRun[]> => {
        let checks: GqlCommitChecks;
        try {
            checks = await getCommitChecksGraphQL(
                accessToken,
                owner,
                repo,
                commitSha,
            );
        } catch (error) {
            if (!isOrgRestrictionError(error)) throw error;
            checks = await getCommitChecksRest(
                accessToken,
                owner,
                repo,
                commitSha,
            );
        }

        const checkRunItems = checks.checkRuns.map((check) => ({
            name: check.name,
            conclusion: check.conclusion,
            status: check.status,
            description: check.title ?? check.summary,
            html_url: check.url ?? undefined,
            details_url: check.detailsUrl,
            started_at: check.startedAt,
            completed_at: check.completedAt,
            app: check.app
                ? {
                      name: check.app.name,
                      owner: check.app.logoUrl
                          ? { avatar_url: check.app.logoUrl }
                          : null,
                  }
                : null,
        }));

        const statusItems = deduplicateCommitStatuses(
            checks.statuses.map((s) => ({
                state: s.state,
                target_url: s.targetUrl,
                description: s.description,
                context: s.context,
                created_at: s.createdAt,
                updated_at: s.updatedAt,
                creator: s.creator
                    ? {
                          login: s.creator.login,
                          avatar_url: s.creator.avatarUrl,
                          html_url: s.creator.url,
                      }
                    : null,
            })),
        ).map(mapStatusToCheckRun);

        return [...checkRunItems, ...statusItems];
    },
);

/**
 * REST fallback for getCommitChecksGraphQL. Organizations with OAuth App
 * access restrictions enabled reject graphql even for public repository
 * data, so the same data comes from checks.listForRef and
 * repos.listCommitStatusesForRef instead.
 */
async function getCommitChecksRest(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
): Promise<GqlCommitChecks> {
    const octokit = createOctokit(accessToken);
    const [checkRunsRes, statusesRes] = await Promise.all([
        octokit.checks.listForRef({ owner, repo, ref: commitSha }),
        octokit.repos.listCommitStatusesForRef({
            owner,
            repo,
            ref: commitSha,
        }),
    ]);

    const checkRuns = checkRunsRes.data.check_runs.map((run) => ({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        title: run.output?.title ?? null,
        summary: run.output?.summary ?? null,
        detailsUrl: run.details_url ?? null,
        url: run.html_url ?? null,
        startedAt: run.started_at ?? null,
        completedAt: run.completed_at ?? null,
        // REST check runs carry the app name but not its logo.
        app: run.app ? { name: run.app.name, logoUrl: null } : null,
    }));

    const statuses = statusesRes.data.map((s) => ({
        context: s.context,
        description: s.description ?? null,
        state: s.state.toLowerCase(),
        targetUrl: s.target_url ?? null,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        creator: s.creator
            ? {
                  login: s.creator.login,
                  avatarUrl: s.creator.avatar_url,
                  url: s.creator.html_url,
              }
            : null,
    }));

    return { checkRuns, statuses };
}

export const getCommit = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.repos.getCommit({
            owner,
            repo,
            ref: commitSha,
        });
        return response.data;
    },
);

export async function getCachedCommit(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    userId?: string | null,
): Promise<CommitData> {
    const permission = userId
        ? await readCache<string>(`permission:${owner}:${repo}:${userId}`)
        : null;

    if (!permission || permission === "none") {
        return getCommit(accessToken, owner, repo, commitSha);
    }

    return withStaleWhileRevalidate(
        `commit:${owner}:${repo}:${commitSha}`,
        () => getCommit(accessToken, owner, repo, commitSha),
        {
            staleAfter: 6 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}
