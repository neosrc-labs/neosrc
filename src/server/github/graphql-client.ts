import {
    GraphqlResponseError,
    graphql as octokitGraphql,
} from "@octokit/graphql";
import { getProviderTokenRefresh } from "~/server/auth/token-registry";

/** True when a request failed because the token was rejected. */
export function isUnauthorizedError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 401
    );
}

/** Creates a GraphQL client that refreshes a rejected token once. */
export function createGraphql(auth: string) {
    const refresh = getProviderTokenRefresh(auth);
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${auth}` },
    });
    if (!refresh) return graphql;

    let didRefresh = false;
    return (async (query: string, parameters?: Record<string, unknown>) => {
        try {
            return await graphql(query, parameters);
        } catch (error) {
            if (didRefresh || !isUnauthorizedError(error)) throw error;
            didRefresh = true;
            const token = await refresh();
            return octokitGraphql.defaults({
                headers: { authorization: `bearer ${token}` },
            })(query, parameters);
        }
    }) as typeof octokitGraphql;
}

export type GraphqlClient = ReturnType<typeof createGraphql>;

/** True when an organization blocks the OAuth app from GraphQL access. */
export function isOrgRestrictionError(error: unknown): boolean {
    if (!(error instanceof GraphqlResponseError)) return false;
    return (
        error.errors?.some(
            (item) =>
                item.type === "FORBIDDEN" &&
                item.message.includes("OAuth App access restrictions"),
        ) === true
    );
}
