import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";
import type { RefreshableAuth } from "~/server/auth";
import { isUnauthorizedError } from "~/server/github-graphql";

export type TeamGetByNameResponseData =
    RestEndpointMethodTypes["teams"]["getByName"]["response"]["data"];
export function createOctokit(auth: string | RefreshableAuth) {
    const refresh = (auth as RefreshableAuth).refresh;
    if (typeof refresh !== "function") {
        return new Octokit({ auth: String(auth) });
    }

    // The stored token may be dead while accessTokenExpiresAt still looks
    // valid (revoked or manually replaced token). Swap in a fresh token and
    // retry once when GitHub rejects the current one with a 401.
    let token = String(auth);
    let didRefresh = false;
    return new Octokit({
        authStrategy: (authOptions: {
            token: string;
            refresh: () => Promise<string>;
        }) => ({
            type: "token",
            token: authOptions.token,
            auth: async () => ({ type: "token", token, tokenType: "oauth" }),
            hook: async (
                request: {
                    endpoint: {
                        merge: (
                            route: string,
                            parameters?: Record<string, unknown>,
                        ) => { headers: Record<string, string> } & Record<
                            string,
                            unknown
                        >;
                    };
                    (options: object): Promise<unknown>;
                },
                route: string,
                parameters?: Record<string, unknown>,
            ) => {
                const endpoint = request.endpoint.merge(route, parameters);
                endpoint.headers.authorization = `token ${token}`;
                try {
                    return await request(endpoint);
                } catch (error) {
                    if (didRefresh || !isUnauthorizedError(error)) throw error;
                    didRefresh = true;
                    token = await authOptions.refresh();
                    endpoint.headers.authorization = `token ${token}`;
                    return request(endpoint);
                }
            },
        }),
        auth: { token: String(auth), refresh },
    });
}
export const getAuthenticatedUser = cache(async (accessToken: string) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.users.getAuthenticated();
    return response.data;
});
export const getGitHubUser = cache(
    async (accessToken: string, username: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.users.getByUsername({ username });
        return response.data;
    },
);

export const getGitHubTeam = cache(
    async (accessToken: string, org: string, teamSlug: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.teams.getByName({
            org,
            team_slug: teamSlug,
        });
        return response.data;
    },
);
type ListInstallationsResponse = Awaited<
    ReturnType<Octokit["apps"]["listInstallationsForAuthenticatedUser"]>
>["data"];
export type Installation = ListInstallationsResponse["installations"][number];

export async function getGitHubAppInstallations(
    accessToken: string,
    slug: string,
): Promise<Installation[]> {
    const octokit = createOctokit(accessToken);
    const { data, status } =
        await octokit.apps.listInstallationsForAuthenticatedUser();

    if (status !== 200) {
        throw Error(`Failed with ${status}`);
    }

    return data.installations.filter(
        (installation) => installation.app_slug === slug,
    );
}
