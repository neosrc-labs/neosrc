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
      <main className="container mx-auto px-4 py-8">
        <p>Please sign in to view this pull request.</p>
      </main>
    );
  }

  const [account] = await db
    .select({ accessToken: accounts.access_token })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .limit(1);

  if (!account?.accessToken) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p>GitHub account not connected properly.</p>
      </main>
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
      <main className="container mx-auto px-4 py-8">
        <p>Failed to fetch pull request data.</p>
      </main>
    );
  }

  const pullRequest = await response.json();

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{pullRequest.title}</h1>
      <p className="mt-2 text-gray-600">
        #{number} by {pullRequest.user?.login}
      </p>
    </main>
  );
}
