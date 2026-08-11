import { env } from "~/env";

export function isGitHubAppConfigured(): boolean {
    return (
        !!env.GITHUB_APP_ID &&
        !!env.GITHUB_APP_PRIVATE_KEY &&
        !!env.GITHUB_APP_SLUG
    );
}

export function githubAppInstallUrl(): string {
    if (!env.GITHUB_APP_SLUG) {
        throw new Error("GITHUB_APP_SLUG is not set");
    }
    return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}
