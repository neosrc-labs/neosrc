export function githubPullRequestCheckUrl(
    url: string,
    pullRequestNumber: number,
): string {
    try {
        const parsed = new URL(url);
        const isGitHubActionsJob =
            parsed.hostname === "github.com" &&
            /^\/[^/]+\/[^/]+\/actions\/runs\/\d+\/job\/\d+\/?$/.test(
                parsed.pathname,
            );

        if (!isGitHubActionsJob) return url;

        parsed.searchParams.set("pr", String(pullRequestNumber));
        return parsed.toString();
    } catch {
        return url;
    }
}
