import type { BetterAuthOptions, DBAdapter } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { DrizzleQueryError } from "drizzle-orm";
import type { db } from "~/server/db";
import {
    betterAuthAccount,
    betterAuthSession,
    betterAuthUser,
    betterAuthVerification,
} from "~/server/db/schema";

function isConnectionClosed(error: unknown): boolean {
    if (error instanceof DrizzleQueryError) {
        return isConnectionClosed(error.cause);
    }
    return (
        error instanceof Error &&
        "code" in error &&
        error.code === "CONNECTION_CLOSED"
    );
}

export function createAuthDatabaseAdapter(database: typeof db) {
    const createAdapter = drizzleAdapter(database, {
        provider: "pg",
        schema: {
            user: betterAuthUser,
            session: betterAuthSession,
            account: betterAuthAccount,
            verification: betterAuthVerification,
        },
    });

    return (options: BetterAuthOptions): DBAdapter => {
        const adapter = createAdapter(options);
        return {
            ...adapter,
            async findOne<T>(args: Parameters<DBAdapter["findOne"]>[0]) {
                // The driver retires failed sockets before the next query.
                // Exhaust stale pooled sockets, then allow one fresh connection.
                for (let attempt = 0; ; attempt += 1) {
                    try {
                        return await adapter.findOne<T>(args);
                    } catch (error) {
                        if (
                            args.model !== "session" ||
                            attempt >= database.$client.options.max ||
                            !isConnectionClosed(error)
                        ) {
                            throw error;
                        }
                    }
                }
            },
        };
    };
}
