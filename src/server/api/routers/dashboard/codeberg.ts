import {
    type CodebergRepoMeta,
    type CodebergSearchIssue,
    searchIssuesAcrossRepos,
} from "~/server/codeberg";
import type { ViewerIssueItem, ViewerPullItem } from "./types";

type RepoScopedIssue = CodebergSearchIssue & { repository: CodebergRepoMeta };

// The cross-repo search omits nothing else the lists need, but an item whose
// repository is missing would render a dead link.
function hasRepo(issue: CodebergSearchIssue): issue is RepoScopedIssue {
    return issue.repository != null;
}

/** Open pull requests the viewer authored, newest activity first. */
export async function fetchViewerCodebergPulls(
    accessToken: string,
    limit: number,
): Promise<ViewerPullItem[]> {
    const items = await searchIssuesAcrossRepos(accessToken, {
        type: "pulls",
        state: "open",
        created: true,
        sort: "recentupdate",
        limit,
    });

    return items.filter(hasRepo).map((issue) => ({
        provider: "cb",
        repo: issue.repository.full_name,
        number: issue.number,
        title: issue.title,
        isDraft: issue.pull_request?.draft === true,
        updatedAt: issue.updated_at,
        comments: issue.comments ?? 0,
    }));
}

/** Open issues the viewer authored, newest activity first. */
export async function fetchViewerCodebergIssues(
    accessToken: string,
    limit: number,
): Promise<ViewerIssueItem[]> {
    const items = await searchIssuesAcrossRepos(accessToken, {
        type: "issues",
        state: "open",
        created: true,
        sort: "recentupdate",
        limit,
    });

    return items.filter(hasRepo).map((issue) => ({
        provider: "cb",
        repo: issue.repository.full_name,
        number: issue.number,
        title: issue.title,
        updatedAt: issue.updated_at,
        comments: issue.comments ?? 0,
    }));
}
