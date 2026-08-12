import { sql } from "drizzle-orm";
import {
    bigint,
    foreignKey,
    index,
    pgEnum,
    pgMaterializedView,
    pgTableCreator,
    primaryKey,
    unique,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `${name}`);

export const providerEnum = pgEnum("provider", ["github", "codeberg"]);

export const repoVisibilityEnum = pgEnum("repo_visibility", [
    "private",
    "public",
]);

export const accountTypeEnum = pgEnum("account_type", ["user", "org"]);

export const permissionLevelEnum = pgEnum("permission_level", [
    "read",
    "triage",
    "write",
    "maintain",
    "admin",
]);

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

export const account = createTable(
    "account",
    (d) => ({
        id: d.bigserial({ mode: "number" }).notNull().primaryKey(),
        provider: providerEnum("provider").notNull(),
        providerId: d.bigint("provider_id", { mode: "number" }).notNull(),
        username: d.varchar({ length: 255 }).notNull(),
        type: accountTypeEnum("type").notNull(),
        avatarUrl: d.text("avatar_url"),
        createdAt: d
            .timestamp("created_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
        updatedAt: d
            .timestamp("updated_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
    }),
    (t) => [
        unique("uk_user_provider_username").on(t.provider, t.username),
        unique("uk_user_provider_id").on(t.provider, t.providerId),
        // Case-insensitive owner lookups (repo cache + permission checks) filter
        // on lower(username); a raw-column btree cannot serve that predicate.
        index("idx_account_provider_lower_username").on(
            t.provider,
            sql`lower(${t.username})`,
        ),
    ],
);

export const repo = createTable(
    "repo",
    (d) => ({
        id: d.bigserial({ mode: "number" }).notNull().primaryKey(),
        accountId: d.bigint("account_id", { mode: "number" }).notNull(),
        provider: providerEnum("provider").notNull(),
        providerId: d.bigint("provider_id", { mode: "number" }).notNull(),
        name: d.varchar({ length: 255 }).notNull(),
        description: d.text("description"),
        visibility: repoVisibilityEnum("visibility")
            .notNull()
            .default("public"),
        stars: d.integer("stars").notNull().default(0),
        watchers: d.integer("watchers").notNull().default(0),
        forks: d.integer("forks").notNull().default(0),
        defaultBranch: d.varchar("default_branch", { length: 255 }),
        archived: d.boolean("archived").notNull().default(false),
        lastSynced: d.timestamp("last_synced", {
            withTimezone: true,
            mode: "date",
        }),
        rawData: d.jsonb("raw_data"),
        createdAt: d
            .timestamp("created_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
        updatedAt: d
            .timestamp("updated_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
    }),
    (t) => [
        foreignKey({
            name: "repo_account_id_fkey",
            columns: [t.accountId],
            foreignColumns: [account.id],
        }).onDelete("cascade"),
        unique("uk_repo_account_name").on(t.accountId, t.name),
        unique("uk_repo_provider_id").on(t.provider, t.providerId),
        // Case-insensitive repo-name lookups filter on lower(name); a raw-column
        // btree cannot serve that predicate.
        index("idx_repo_provider_lower_name").on(
            t.provider,
            sql`lower(${t.name})`,
        ),
    ],
);

// Polymorphic ACL tuple. resource_id/subject_id reference different id spaces
// depending on resource_type/subject_type:
//   - user/org subjects and repo/org resources: local account.id / repo.id
//   - team subjects and team resources: the provider's team id
export const relation = createTable(
    "relation",
    (d) => ({
        id: d.bigserial({ mode: "number" }).notNull().primaryKey(),
        resourceType: d.varchar("resource_type", { length: 50 }).notNull(),
        resourceId: d.bigint("resource_id", { mode: "number" }).notNull(),
        relation: d.varchar({ length: 50 }).notNull(),
        subjectType: d.varchar("subject_type", { length: 50 }).notNull(),
        subjectId: d.bigint("subject_id", { mode: "number" }).notNull(),
        createdAt: d
            .timestamp("created_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
    }),
    (t) => [
        // Column order follows drizzle-kit's index introspection (the planner
        // may reorder multi-column constraints); keeping it aligned avoids a
        // perpetual drop/re-add diff on every `drizzle-kit push`.
        unique("uk_relation").on(
            t.relation,
            t.resourceId,
            t.resourceType,
            t.subjectId,
            t.subjectType,
        ),
        index("idx_tuple_resource").on(t.resourceType, t.resourceId),
        index("idx_tuple_subject").on(t.subjectType, t.subjectId),
    ],
);

// Incremental sync bookkeeping: the snapshot hash of the last applied
// permission sync per user, so a 30s poll can skip all writes and the
// materialized-view refresh while nothing changed.
export const permissionsSyncState = createTable(
    "permissions_sync_state",
    (d) => ({
        provider: providerEnum("provider").notNull(),
        userId: d
            .text("user_id")
            .notNull()
            .references(() => betterAuthUser.id),
        snapshotHash: d.text("snapshot_hash").notNull(),
        updatedAt: d
            .timestamp("updated_at", { withTimezone: true, mode: "date" })
            .notNull()
            .defaultNow(),
    }),
    (t) => [primaryKey({ columns: [t.provider, t.userId] })],
);

export const mvUserRepoPermissions = pgMaterializedView(
    "mv_user_repo_permissions",
    {
        userId: bigint("user_id", { mode: "number" }),
        repoId: bigint("repo_id", { mode: "number" }),
        effectivePermission: permissionLevelEnum("effective_permission"),
    },
).as(sql`
    WITH RECURSIVE subject_expansion AS (
        SELECT
            id AS user_id,
            'user'::VARCHAR(50) AS subject_type,
            id AS subject_id
        FROM account
        WHERE type = 'user'

        UNION

        SELECT
            se.user_id,
            rt.resource_type AS subject_type,
            rt.resource_id AS subject_id
        FROM subject_expansion se
        JOIN relation rt
          ON rt.subject_type = se.subject_type
         AND rt.subject_id = se.subject_id
        WHERE rt.relation IN ('member', 'owner', 'admin')
    ),
    all_grants AS (
        SELECT
            se.user_id,
            rt.resource_id AS repo_id,
            CASE rt.relation
                WHEN 'owner'      THEN 'admin'::permission_level
                WHEN 'admin'      THEN 'admin'::permission_level
                WHEN 'maintainer' THEN 'maintain'::permission_level
                WHEN 'writer'     THEN 'write'::permission_level
                WHEN 'triager'    THEN 'triage'::permission_level
                WHEN 'reader'     THEN 'read'::permission_level
            END AS permission
        FROM subject_expansion se
        JOIN relation rt
          ON rt.subject_type = se.subject_type
         AND rt.subject_id = se.subject_id
        WHERE rt.resource_type = 'repo'
          AND rt.relation IN (
              'owner', 'admin', 'maintainer', 'writer', 'triager', 'reader'
          )

        UNION ALL

        SELECT
            r.account_id AS user_id,
            r.id AS repo_id,
            'admin'::permission_level AS permission
        FROM repo r
        JOIN account a ON a.id = r.account_id
        WHERE a.type = 'user'
    )
    SELECT
        user_id,
        repo_id,
        CASE MAX(
            CASE permission
                WHEN 'read'     THEN 1
                WHEN 'triage'   THEN 2
                WHEN 'write'    THEN 3
                WHEN 'maintain' THEN 4
                WHEN 'admin'    THEN 5
            END
        )
            WHEN 1 THEN 'read'::permission_level
            WHEN 2 THEN 'triage'::permission_level
            WHEN 3 THEN 'write'::permission_level
            WHEN 4 THEN 'maintain'::permission_level
            WHEN 5 THEN 'admin'::permission_level
        END AS effective_permission
    FROM all_grants
    GROUP BY user_id, repo_id
`);
