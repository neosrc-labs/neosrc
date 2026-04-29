import type { ReactNode } from "react";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import LeftSidebar from "./_components/left-sidebar";
import RightSidebar from "./_components/right-sidebar";

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

  let pullRequest = null;

  if (session?.user?.id) {
    const [account] = await db
      .select({ accessToken: accounts.access_token })
      .from(accounts)
      .where(eq(accounts.userId, session.user.id))
      .limit(1);

    if (account?.accessToken) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          next: { revalidate: 60 },
        }
      );

      if (response.ok) {
        pullRequest = await response.json();
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
        />
      </div>

      {/* Middle Section - PR Content */}
      <main className="min-w-0 border-r border-gray-200 bg-white">
        {children}
      </main>

      {/* Right Sidebar - Sticky */}
      <div className="sticky top-0 h-screen overflow-y-auto">
        <RightSidebar pullRequest={pullRequest} />
      </div>
    </div>
  );
}
