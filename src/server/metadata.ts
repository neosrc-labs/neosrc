import type { Metadata } from "next";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { createOctokit, getPullRequest } from "~/server/github";
import { eq } from "drizzle-orm";

export async function generatePRMetadata(
	owner: string,
	repo: string,
	number: string,
): Promise<Metadata> {
	let title = `${owner}/${repo} #${number}`;

	try {
		const session = await auth();
		if (session?.user?.id) {
			const [account] = await db
				.select({ accessToken: accounts.access_token })
				.from(accounts)
				.where(eq(accounts.userId, session.user.id))
				.limit(1);

			if (account?.accessToken) {
				const octokit = createOctokit(account.accessToken);
				const pullRequest = await getPullRequest(
					octokit,
					owner,
					repo,
					parseInt(number, 10),
				);
				title = `${pullRequest.title} · ${owner}/${repo}`;
			}
		}
	} catch {
		// Use default title if fetch fails
	}

	return { title };
}
