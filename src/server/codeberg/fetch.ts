import { getProviderTokenRefresh } from "~/server/auth/token-registry";

/** Retries one rejected Codeberg request with a broker-refreshed token. */
export async function codebergFetch(
    accessToken: string,
    input: string | URL,
    init?: RequestInit,
): Promise<Response> {
    const response = await fetch(input, init);
    const refresh = getProviderTokenRefresh(accessToken);
    if (response.status !== 401 || typeof refresh !== "function") {
        return response;
    }

    const token = await refresh();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `token ${token}`);
    return fetch(input, { ...init, headers });
}
