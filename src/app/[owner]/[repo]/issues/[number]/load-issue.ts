import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";
import type { IssueDetail } from "~/server/api/routers/issues/types";
import {
    mapCodebergIssueDetail,
    mapGitHubIssueDetail,
} from "~/server/api/routers/mappers";
import { getIssue as getCodebergIssue } from "~/server/codeberg";
import { getIssue as getGitHubIssue } from "~/server/github";
import type { Provider } from "~/utils/provider-url";

/**
 * Issue detail loader shared by the issue route's layout and page. Both
 * providers serve pull requests from `/issues/<n>` as well, so a number that
 * resolves to a pull request redirects to the pull request page; a missing
 * number renders the 404 page instead of bubbling the provider error into the
 * error boundary.
 */
export function loadIssueForRoute(
    provider: Provider,
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
): Promise<IssueDetail> {
    if (provider === "cb") {
        return getCodebergIssue(accessToken, owner, repo, issueNumber)
            .catch((error: unknown) => {
                // The Codeberg client maps a 404 to a NOT_FOUND TRPCError; any
                // other failure (auth, outage) must propagate as-is.
                if (error instanceof TRPCError && error.code === "NOT_FOUND") {
                    notFound();
                }
                throw error;
            })
            .then((issue) => {
                if (issue.pull_request) {
                    redirect(`/cb/${owner}/${repo}/pull/${issueNumber}`);
                }
                return mapCodebergIssueDetail(issue, owner, repo);
            });
    }

    return getGitHubIssue(accessToken, owner, repo, issueNumber)
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
            return mapGitHubIssueDetail(issue);
        });
}
