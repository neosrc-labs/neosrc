const MAX_REGISTERED_TOKENS = 1_000;
const tokenRefreshers = new Map<string, () => Promise<string>>();

export function registerProviderTokenRefresh(
    token: string,
    refresh: () => Promise<string>,
): string {
    tokenRefreshers.delete(token);
    tokenRefreshers.set(token, refresh);
    while (tokenRefreshers.size > MAX_REGISTERED_TOKENS) {
        const oldest = tokenRefreshers.keys().next().value;
        if (!oldest) break;
        tokenRefreshers.delete(oldest);
    }
    return token;
}

export function getProviderTokenRefresh(
    token: string,
): (() => Promise<string>) | undefined {
    return tokenRefreshers.get(token);
}
