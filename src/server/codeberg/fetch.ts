import { getProviderTokenRefresh } from "~/server/auth/token-registry";

/** Sends an authenticated Codeberg request and retries one rejected token. */
export async function codebergFetch(
    accessToken: string,
    input: string | URL,
    init?: RequestInit,
): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (accessToken) headers.set("Authorization", `token ${accessToken}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    const request = { ...init, headers };
    const response = await fetch(input, request);
    const refresh = getProviderTokenRefresh(accessToken);
    if (response.status !== 401 || typeof refresh !== "function") {
        return response;
    }

    headers.set("Authorization", `token ${await refresh()}`);
    return fetch(input, request);
}
