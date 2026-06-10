import { graphql as octokitGraphql } from "@octokit/graphql";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getCheckRuns, getCommitStatuses } from "~/server/github";
import {
    deduplicateCommitStatuses,
    mapStatusToCheckRun,
} from "~/utils/status-checks";

interface StatusContext {
    name: string;
    state: string;
    description: string | null;
    url: string | null;
    startedAt: string | null;
    completedAt: string | null;
}

interface GqlContextNode {
    __typename: string;
    name?: string;
    status?: string;
    conclusion?: string | null;
    detailsUrl?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    context?: string;
    description?: string | null;
    state?: string;
    targetUrl?: string | null;
}

interface GqlPrStatusRollup {
    commit?: {
        statusCheckRollup?: {
            state?: string;
            contexts?: {
                nodes?: (GqlContextNode | null)[];
            };
        };
    };
}

interface GqlPrData {
    commits?: {
        nodes?: GqlPrStatusRollup[];
    };
}

function buildPrStatusBatchQuery(numbers: number[]): string {
    const aliases = numbers.map(
        (num, i) => `
  pr${i}: repository(owner: $owner, name: $repo) {
    pullRequest(number: ${num}) {
      commits(last: 1) {
        nodes {
          commit {
            oid
            statusCheckRollup {
              state
              contexts(first: 30) {
                nodes {
                  __typename
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    detailsUrl
                    startedAt
                    completedAt
                  }
                  ... on StatusContext {
                    context
                    description
                    state
                    targetUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }`,
    );

    return `query BatchPrChecks($owner: String!, $repo: String!) {${aliases.join("")}
}`;
}

function extractStatusContexts(
    prData: GqlPrData | null | undefined,
): StatusContext[] {
    const rollup = prData?.commits?.nodes?.[0]?.commit?.statusCheckRollup;
    if (!rollup?.contexts?.nodes) return [];

    return rollup.contexts.nodes
        .filter((n): n is GqlContextNode => n != null)
        .map((ctx) => {
            if (ctx.__typename === "CheckRun") {
                return {
                    name: ctx.name ?? "",
                    state: (ctx.conclusion ?? ctx.status ?? "").toUpperCase(),
                    description: null,
                    url: ctx.detailsUrl ?? null,
                    startedAt: ctx.startedAt ?? null,
                    completedAt: ctx.completedAt ?? null,
                };
            }
            return {
                name: ctx.context ?? "",
                state: ctx.state ?? "",
                description: ctx.description ?? null,
                url: ctx.targetUrl ?? null,
                startedAt: null,
                completedAt: null,
            };
        });
}

export const checksRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                sha: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const [checks, statuses] = await Promise.all([
                getCheckRuns(accessToken, input.owner, input.repo, input.sha),
                getCommitStatuses(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.sha,
                ),
            ]);
            const checkRunItems = (checks.check_runs ?? []).map((check) => ({
                name: check.name,
                conclusion: check.conclusion,
                status: check.status,
                description: check.output.title ?? check.output.summary,
                html_url: check.html_url ?? undefined,
                details_url: check.details_url,
                started_at: check.started_at,
                completed_at: check.completed_at,
                app: check.app
                    ? {
                          name: check.app.name,
                          owner: check.app.owner
                              ? { avatar_url: check.app.owner.avatar_url }
                              : null,
                      }
                    : null,
            }));

            const statusItems = deduplicateCommitStatuses(statuses ?? []).map(
                mapStatusToCheckRun,
            );

            return [...checkRunItems, ...statusItems];
        }),

    listByPrNumbers: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                prNumbers: z.array(z.number()),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const graphql = octokitGraphql.defaults({
                headers: { authorization: `bearer ${accessToken}` },
            });

            const query = buildPrStatusBatchQuery(input.prNumbers);
            const raw = await graphql<Record<string, unknown>>(query, {
                owner: input.owner,
                repo: input.repo,
            });

            return input.prNumbers.reduce<Record<number, StatusContext[]>>(
                (acc, num, i) => {
                    const entry = raw[`pr${i}`] as
                        | { pullRequest?: GqlPrData }
                        | undefined;
                    acc[num] = extractStatusContexts(entry?.pullRequest);
                    return acc;
                },
                {},
            );
        }),
});
