import { pgTableCreator, primaryKey } from "drizzle-orm/pg-core";

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

export const betterAuthSession = createTable("ba_session", (d) => ({
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
}));

export const betterAuthAccount = createTable("ba_account", (d) => ({
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
    refreshTokenExpiresAt: d.timestamp({ withTimezone: true, mode: "date" }),
    scope: d.text(),
    password: d.text(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const betterAuthVerification = createTable("ba_verification", (d) => ({
    id: d.text().notNull().primaryKey(),
    identifier: d.text().notNull(),
    value: d.text().notNull(),
    expiresAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const cache = createTable("cache", (d) => ({
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
}));

export const apiKey = createTable("api_key", (d) => ({
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
}));

export const apiKeyPermission = createTable("api_key_permission", (d) => ({
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
}));

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
