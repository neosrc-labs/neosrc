import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `${name}`);

export const betterAuthUser = createTable("ba_user", (d) => ({
    id: d.text().notNull().primaryKey(),
    name: d.text().notNull(),
    email: d.text().notNull().unique(),
    emailVerified: d.boolean().notNull(),
    image: d.text(),
    githubUsername: d.text(),
    codebergUsername: d.text(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const betterAuthSession = createTable(
    "ba_session",
    (d) => ({
        id: d.text().notNull().primaryKey(),
        expiresAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
        token: d.text().notNull().unique(),
        createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
        updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
        ipAddress: d.text(),
        userAgent: d.text(),
        userId: d
            .text()
            .notNull()
            .references(() => betterAuthUser.id),
    }),
    (t) => [
        // FK lookups (session -> user) and per-user queries hit this column.
        index("ba_session_userId_idx").on(t.userId),
    ],
);

export const betterAuthAccount = createTable(
    "ba_account",
    (d) => ({
        id: d.text().notNull().primaryKey(),
        accountId: d.text().notNull(),
        providerId: d.text().notNull(),
        userId: d
            .text()
            .notNull()
            .references(() => betterAuthUser.id),
        accessToken: d.text(),
        refreshToken: d.text(),
        idToken: d.text(),
        accessTokenExpiresAt: d.timestamp({ withTimezone: true, mode: "date" }),
        refreshTokenExpiresAt: d.timestamp({
            withTimezone: true,
            mode: "date",
        }),
        scope: d.text(),
        password: d.text(),
        createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
        updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    }),
    (t) => [
        // getGitHubToken filters by userId + providerId on every authenticated request.
        index("ba_account_userId_idx").on(t.userId),
    ],
);

export const betterAuthVerification = createTable("ba_verification", (d) => ({
    id: d.text().notNull().primaryKey(),
    identifier: d.text().notNull(),
    value: d.text().notNull(),
    expiresAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const cache = createTable(
    "cache",
    (d) => ({
        key: d.text().notNull().primaryKey(),
        value: d.jsonb().$type<unknown>().notNull(),
        staleAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
        deleteAt: d.timestamp({ withTimezone: true, mode: "date" }),
        createdAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
        updatedAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
    }),
    (t) => [
        // The hourly expired-row sweep filters on deleteAt.
        index("cache_deleteAt_idx").on(t.deleteAt),
    ],
);

export const apiKey = createTable(
    "api_key",
    (d) => ({
        id: d.serial().notNull().primaryKey(),
        name: d.text().notNull(),
        hash: d.text().notNull(),
        owner: d
            .text()
            .notNull()
            .references(() => betterAuthUser.id),
        expirationTimestamp: d.timestamp({ withTimezone: true, mode: "date" }),
        createdAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
        updatedAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
    }),
    (t) => [
        // API-key lookups are scoped by owner.
        index("api_key_owner_idx").on(t.owner),
    ],
);

export const apiKeyPermission = createTable(
    "api_key_permission",
    (d) => ({
        id: d.serial().notNull().primaryKey(),
        kind: d.varchar({ length: 64 }).notNull(),
        apiKeyId: d
            .integer()
            .notNull()
            .references(() => apiKey.id, { onDelete: "cascade" }),
        target: d.text().notNull(),
        createdAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
        updatedAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
    }),
    (t) => [
        // Cascade deletes from api_key and per-key permission queries hit this column.
        index("api_key_permission_apiKeyId_idx").on(t.apiKeyId),
    ],
);

export const pullRequestReport = createTable(
    "pull_request_report",
    (d) => ({
        provider: d.varchar({ length: 64 }).notNull(),
        repositorySlug: d.varchar({ length: 255 }).notNull(),
        prNumber: d.integer().notNull(),
        revision: d.integer().notNull(),
        name: d.varchar({ length: 255 }).notNull(),
        title: d.varchar({ length: 255 }).notNull(),
        description: d.text(),
        commitSha: d.varchar({ length: 40 }),
        sourceUrl: d.varchar({ length: 2048 }),
        state: d.varchar({ length: 16 }).notNull().default("VALID"),
        type: d.varchar({ length: 64 }).notNull(),
        data: d.text(),
        createdAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
        updatedAt: d
            .timestamp({ withTimezone: true, mode: "date" })
            .defaultNow()
            .notNull(),
    }),
    (t) => [
        primaryKey({
            columns: [
                t.provider,
                t.repositorySlug,
                t.prNumber,
                t.name,
                t.revision,
            ],
        }),
    ],
);
