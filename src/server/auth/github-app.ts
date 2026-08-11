import { env } from "~/env";

export function githubAppInstallUrl(): string {
    return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}
