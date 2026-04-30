import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { createOctokit, getCommit, getPullRequestFiles } from "~/server/github";

type PullsListFilesResponseData =
	RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"];

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const owner = searchParams.get("owner");
	const repo = searchParams.get("repo");
	const number = searchParams.get("number");
	const sha = searchParams.get("sha");

	if (!owner || !repo || !number) {
		return Response.json(
			{ error: "Missing required parameters: owner, repo, number" },
			{ status: 400 },
		);
	}

	const session = await auth();
	if (!session?.user?.id) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const [account] = await db
		.select({ accessToken: accounts.access_token })
		.from(accounts)
		.where(eq(accounts.userId, session.user.id))
		.limit(1);

	if (!account?.accessToken) {
		return Response.json(
			{ error: "GitHub account not connected" },
			{ status: 400 },
		);
	}

	const octokit = createOctokit(account.accessToken);

	try {
		let files: PullsListFilesResponseData = [];

		if (sha) {
			const commit = await getCommit(octokit, owner, repo, sha);
			files = (commit.files || []) as PullsListFilesResponseData;
		} else {
			files = await getPullRequestFiles(
				octokit,
				owner,
				repo,
				parseInt(number, 10),
			);
		}

		return Response.json({ files });
	} catch (e) {
		console.log(e)
		return Response.json({ error: "Failed to fetch files" }, { status: 500 });
	}
}
