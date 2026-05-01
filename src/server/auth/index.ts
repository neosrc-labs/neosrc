import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";
import { accounts } from "../db/schema";
import { eq } from "drizzle-orm/pg-core/expressions";
import { db } from "../db";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

const githubAccessToken = cache(async () => {
	const session = await auth();

	if (!session?.user?.id) {
		return null
	}

	const [account] = await db
		.select({ accessToken: accounts.access_token })
		.from(accounts)
		.where(eq(accounts.userId, session.user.id))
		.limit(1);

	if (!account?.accessToken) {
		return null
	}
	return account.accessToken;
});


export { auth, handlers, signIn, signOut, githubAccessToken };
