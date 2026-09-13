import { notFound, redirect } from "next/navigation";
import { getIssue, type IssueGetResponseData } from "~/server/github";

/**
 * Issue detail loader shared by the route's layout and page. GitHub serves
 * pull requests from `/issues/<n>` as well, so a number that resolves to a
 * pull request redirects to the pull request page; a missing number renders
 * the 404 page instead of bubbling a REST 404 into the error boundary.
 */
export function loadIssueForRoute(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
): Promise<IssueGetResponseData> {
    return getIssue(accessToken, owner, repo, issueNumber)
        .catch((error: unknown) => {
            // A missing issue surfaces as a 404 from the REST client; any
            // other failure (rate limit, outage) must propagate as-is.
            if ((error as { status?: number } | null)?.status === 404) {
                notFound();
            }
            throw error;
        })
        .then((issue) => {
            if (issue.pull_request) {
                redirect(`/gh/${owner}/${repo}/pull/${issueNumber}`);
            }
            return issue;
        });
}
