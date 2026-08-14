import { getGhToken, shaTargetInput } from "~/server/api/routers/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getChecksForCommit } from "~/server/github";

export interface StatusContext {
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

export interface GqlPrData {
    mergeStateStatus?: string;
    commits?: {
        nodes?: GqlPrStatusRollup[];
    };
}

export function buildPrStatusBatchQuery(numbers: number[]): string {
    const aliases = numbers.map(
        (num, i) => `
  pr${i}: repository(owner: $owner, name: $repo) {
    pullRequest(number: ${num}) {
      mergeStateStatus
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

export function extractStatusContexts(
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

export function extractMergeStateStatus(
    prData: GqlPrData | null | undefined,
): string | null {
    return prData?.mergeStateStatus ?? null;
}

export interface PrDetailsEntry {
    mergeStateStatus: string | null;
    statusContexts: StatusContext[];
}

export const checksRouter = createTRPCRouter({
    list: protectedProcedure
        .input(shaTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return getChecksForCommit(
                accessToken,
                input.owner,
                input.repo,
                input.sha,
            );
        }),
});
