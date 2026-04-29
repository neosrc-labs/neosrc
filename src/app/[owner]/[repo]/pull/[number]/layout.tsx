import type { ReactNode } from "react";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import LeftSidebar from "./_components/left-sidebar";
import RightSidebar from "./_components/right-sidebar";
import { createOctokit, getPullRequest, getPullRequestCommits, getCheckRuns } from "~/server/github";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

type PullsGetResponseData = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type PullsListCommitsResponseData = RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];

interface LayoutProps {
  children: ReactNode;
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
}

export default async function PullRequestLayout({
  children,
  params,
}: LayoutProps) {
  const { owner, repo, number } = await params;
  const session = await auth();

  let pullRequest: PullsGetResponseData | null = null;
  let commits: PullsListCommitsResponseData = [];
  let checks: Array<{
    name: string;
    conclusion: string | null;
    status: string;
    html_url?: string | undefined;
  }> = [];

  if (session?.user?.id) {
    const [account] = await db
      .select({ accessToken: accounts.access_token })
      .from(accounts)
      .where(eq(accounts.userId, session.user.id))
      .limit(1);

    if (account?.accessToken) {
      const octokit = createOctokit(account.accessToken);

      const [prResult, commitsResult] = await Promise.allSettled([
        getPullRequest(octokit, owner, repo, parseInt(number)),
        getPullRequestCommits(octokit, owner, repo, parseInt(number)),
      ]);

      if (commitsResult.status === "fulfilled") {
        commits = commitsResult.value;
      }

      // Fetch check runs if we have the PR head SHA
      if (prResult.status === "fulfilled") {
        pullRequest = prResult.value;
        if (pullRequest?.head?.sha) {
          const checksResult = await getCheckRuns(
            octokit,
            owner,
            repo,
            pullRequest.head.sha
          );

           checks = (checksResult.check_runs || []).map((check: { name: string; conclusion: string | null; status: string; html_url?: string | undefined }) => ({
            name: check.name,
            conclusion: check.conclusion,
            status: check.status,
            html_url: check.html_url,
          }));
        }
      }
    }
  }

  return (
    <div className="grid grid-cols-[250px_1fr_300px]">
      {/* Left Sidebar - Sticky */}
      <div className="sticky top-0 h-screen overflow-y-auto">
        <LeftSidebar
          owner={owner}
          repo={repo}
          number={number}
          activeTab="conversation"
          checks={checks}
        />
      </div>

      {/* Middle Section - PR Content */}
      <main className="min-w-0 border-r border-gray-200 bg-white">
        {children}
      </main>

      {/* Right Sidebar - Sticky */}
      <div className="sticky top-0 h-screen overflow-y-auto">
        <RightSidebar pullRequest={pullRequest} commits={commits} />
      </div>
    </div>
  );
}
