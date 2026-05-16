import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { db } from "~/server/db";
import {
    accounts,
    sessions,
    users,
    verificationTokens,
} from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
    interface Session extends DefaultSession {
        user: {
            id: string;
            // ...other properties
            // role: UserRole;
        } & DefaultSession["user"];
    }

    // interface User {
    //   // ...other properties
    //   // role: UserRole;
    // }
}

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function refreshAccessToken(refreshToken: string) {
    const res = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: process.env.AUTH_GITHUB_ID,
            client_secret: process.env.AUTH_GITHUB_SECRET,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    const refreshed = await res.json();

    if (!res.ok || refreshed.error) {
        throw new Error(
            refreshed.error_description ?? "Failed to refresh token",
        );
    }

    return refreshed as {
        access_token: string;
        expires_in: number;
        refresh_token: string;
        refresh_token_expires_in: number;
    };
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 * @see https://next-auth.js.org/providers/github
 */
export const authConfig = {
    providers: [
        GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            authorization: {
                params: { scope: "read:user user:email repo public_repo" },
            },
        }),
    ],
    adapter: DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
    }),
    callbacks: {
        async signIn({ account }) {
            if (
                account?.provider === "github" &&
                account.refresh_token_expires_in
            ) {
                await db
                    .update(accounts)
                    .set({
                        refresh_token_expires_in: Math.floor(
                            Date.now() / 1000 +
                                (account.refresh_token_expires_in as number),
                        ),
                    })
                    .where(
                        eq(
                            accounts.providerAccountId,
                            account.providerAccountId,
                        ),
                    );
            }
            return true;
        },
        async session({ session, user }) {
            if (user.id) {
                const [account] = await db
                    .select()
                    .from(accounts)
                    .where(eq(accounts.userId, user.id))
                    .limit(1);

                if (
                    account?.expires_at &&
                    account.expires_at < Date.now() &&
                    account?.refresh_token
                ) {
                    console.log("refreshing token");
                    const refresh = await refreshAccessToken(
                        account.refresh_token,
                    );
                    await db
                        .update(accounts)
                        .set({
                            access_token: refresh.access_token,
                            refresh_token: refresh.refresh_token,
                            expires_at: Date.now() + refresh.expires_in * 1000,
                            refresh_token_expires_in: Math.floor(
                                Date.now() / 1000 +
                                    (refresh.refresh_token_expires_in as number),
                            ),
                        })
                        .where(
                            eq(
                                accounts.providerAccountId,
                                account.providerAccountId,
                            ),
                        );
                }
            }

            return {
                ...session,
                user: {
                    ...session.user,
                    id: user.id,
                },
            };
        },
    },
} satisfies NextAuthConfig;
