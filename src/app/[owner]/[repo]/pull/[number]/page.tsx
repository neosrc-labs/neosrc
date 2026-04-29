import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
}

export default async function PullRequestPage({ params }: PageProps) {
  const { owner, repo, number } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="px-6 py-8">
        <p className="text-gray-600">Please sign in to view this pull request.</p>
      </div>
    );
  }

  const [account] = await db
    .select({ accessToken: accounts.access_token })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .limit(1);

  if (!account?.accessToken) {
    return (
      <div className="px-6 py-8">
        <p className="text-gray-600">GitHub account not connected properly.</p>
      </div>
    );
  }

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

  if (!response.ok) {
    return (
      <div className="px-6 py-8">
        <p className="text-gray-600">Failed to fetch pull request data.</p>
      </div>
    );
  }

  const pullRequest = await response.json();

  return (
    <div className="px-6 py-8">
      {/* PR Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {pullRequest.title}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          #{number} opened by {pullRequest.user?.login}
        </p>
      </div>

      {/* PR Description */}
      <div className="prose prose-sm max-w-none">
        {pullRequest.body ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-700">
            {pullRequest.body}
          </pre>
        ) : (
          <p className="text-gray-500 italic">No description provided.</p>
        )}
      </div>

      {/* Comments Placeholder */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Comments</h2>
        <p className="text-sm text-gray-500">Comments section coming soon.</p>
      </div>
    </div>
  );
}
