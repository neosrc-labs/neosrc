import { pgTable, index, foreignKey, text, timestamp, unique, jsonb, boolean, serial, varchar, integer, bigserial, bigint, primaryKey, pgMaterializedView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const accountType = pgEnum("account_type", ['user', 'org'])
export const permissionLevel = pgEnum("permission_level", ['read', 'triage', 'write', 'maintain', 'admin'])
export const provider = pgEnum("provider", ['github', 'codeberg'])


export const baAccount = pgTable("ba_account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ba_account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [baUser.id],
			name: "ba_account_userId_ba_user_id_fk"
		}),
]);

export const baSession = pgTable("ba_session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
}, (table) => [
	index("ba_session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [baUser.id],
			name: "ba_session_userId_ba_user_id_fk"
		}),
	unique("ba_session_token_unique").on(table.token),
]);

export const baVerification = pgTable("ba_verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
});

export const cache = pgTable("cache", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	staleAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	deleteAt: timestamp({ withTimezone: true, mode: 'string' }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cache_deleteAt_idx").using("btree", table.deleteAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const baUser = pgTable("ba_user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().notNull(),
	image: text(),
	githubUsername: text(),
	codebergUsername: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("ba_user_email_unique").on(table.email),
]);

export const apiKey = pgTable("api_key", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	hash: text().notNull(),
	owner: text().notNull(),
	expirationTimestamp: timestamp({ withTimezone: true, mode: 'string' }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_key_owner_idx").using("btree", table.owner.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.owner],
			foreignColumns: [baUser.id],
			name: "api_key_owner_ba_user_id_fk"
		}),
]);

export const apiKeyPermission = pgTable("api_key_permission", {
	id: serial().primaryKey().notNull(),
	kind: varchar({ length: 64 }).notNull(),
	apiKeyId: integer().notNull(),
	target: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_key_permission_apiKeyId_idx").using("btree", table.apiKeyId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKey.id],
			name: "api_key_permission_apiKeyId_api_key_id_fk"
		}).onDelete("cascade"),
]);

export const relation = pgTable("relation", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	resourceId: bigint("resource_id", { mode: "number" }).notNull(),
	relation: varchar({ length: 50 }).notNull(),
	subjectType: varchar("subject_type", { length: 50 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subjectId: bigint("subject_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tuple_resource").using("btree", table.resourceType.asc().nullsLast().op("int8_ops"), table.resourceId.asc().nullsLast().op("int8_ops")),
	index("idx_tuple_subject").using("btree", table.subjectType.asc().nullsLast().op("text_ops"), table.subjectId.asc().nullsLast().op("text_ops")),
	unique("uk_relation").on(table.relation, table.resourceId, table.resourceType, table.subjectId, table.subjectType),
]);

export const account = pgTable("account", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	provider: provider().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	providerId: bigint("provider_id", { mode: "number" }).notNull(),
	username: varchar({ length: 255 }).notNull(),
	type: accountType().notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("uk_user_provider_username").on(table.provider, table.username),
	unique("uk_user_provider_id").on(table.provider, table.providerId),
]);

export const repo = pgTable("repo", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	provider: provider().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	providerId: bigint("provider_id", { mode: "number" }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [account.id],
			name: "repo_account_id_fkey"
		}).onDelete("cascade"),
	unique("uk_repo_account_name").on(table.accountId, table.name),
	unique("uk_repo_provider_id").on(table.provider, table.providerId),
]);

export const pullRequestReport = pgTable("pull_request_report", {
	provider: varchar({ length: 64 }).notNull(),
	repositorySlug: varchar({ length: 255 }).notNull(),
	prNumber: integer().notNull(),
	revision: integer().notNull(),
	name: varchar({ length: 255 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	commitSha: varchar({ length: 40 }),
	sourceUrl: varchar({ length: 2048 }),
	state: varchar({ length: 16 }).default('VALID').notNull(),
	type: varchar({ length: 64 }).notNull(),
	data: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.name, table.prNumber, table.provider, table.repositorySlug, table.revision], name: "pull_request_report_provider_repositorySlug_prNumber_name_revis"}),
]);
export const mvUserRepoPermissions = pgMaterializedView("mv_user_repo_permissions", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	repoId: bigint("repo_id", { mode: "number" }),
	effectivePermission: permissionLevel("effective_permission"),
}).as(sql`WITH RECURSIVE subject_expansion AS ( SELECT account.id AS user_id, 'user'::character varying(50) AS subject_type, account.id AS subject_id FROM account WHERE account.type = 'user'::account_type UNION SELECT se.user_id, rt.resource_type AS subject_type, rt.resource_id AS subject_id FROM subject_expansion se JOIN relation rt ON rt.subject_type::text = se.subject_type::text AND rt.subject_id = se.subject_id WHERE rt.relation::text = ANY (ARRAY['member'::character varying, 'owner'::character varying, 'admin'::character varying]::text[]) ), all_grants AS ( SELECT se.user_id, rt.resource_id AS repo_id, CASE rt.relation WHEN 'owner'::text THEN 'admin'::permission_level WHEN 'admin'::text THEN 'admin'::permission_level WHEN 'maintainer'::text THEN 'maintain'::permission_level WHEN 'writer'::text THEN 'write'::permission_level WHEN 'triager'::text THEN 'triage'::permission_level WHEN 'reader'::text THEN 'read'::permission_level ELSE NULL::permission_level END AS permission FROM subject_expansion se JOIN relation rt ON rt.subject_type::text = se.subject_type::text AND rt.subject_id = se.subject_id WHERE rt.resource_type::text = 'repo'::text AND (rt.relation::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'maintainer'::character varying, 'writer'::character varying, 'triager'::character varying, 'reader'::character varying]::text[])) UNION ALL SELECT r.account_id AS user_id, r.id AS repo_id, 'admin'::permission_level AS permission FROM repo r JOIN account a ON a.id = r.account_id WHERE a.type = 'user'::account_type ) SELECT user_id, repo_id, CASE max( CASE permission WHEN 'read'::permission_level THEN 1 WHEN 'triage'::permission_level THEN 2 WHEN 'write'::permission_level THEN 3 WHEN 'maintain'::permission_level THEN 4 WHEN 'admin'::permission_level THEN 5 ELSE NULL::integer END) WHEN 1 THEN 'read'::permission_level WHEN 2 THEN 'triage'::permission_level WHEN 3 THEN 'write'::permission_level WHEN 4 THEN 'maintain'::permission_level WHEN 5 THEN 'admin'::permission_level ELSE NULL::permission_level END AS effective_permission FROM all_grants GROUP BY user_id, repo_id`);