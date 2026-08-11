CREATE TYPE "public"."account_type" AS ENUM('user', 'org');--> statement-breakpoint
CREATE TYPE "public"."permission_level" AS ENUM('read', 'triage', 'write', 'maintain', 'admin');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('github', 'codeberg');--> statement-breakpoint
CREATE TABLE "account" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" "provider" NOT NULL,
	"provider_id" bigint NOT NULL,
	"username" varchar(255) NOT NULL,
	"type" "account_type" NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uk_user_provider_username" UNIQUE("provider","username"),
	CONSTRAINT "uk_user_provider_id" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "relation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" bigint NOT NULL,
	"relation" varchar(50) NOT NULL,
	"subject_type" varchar(50) NOT NULL,
	"subject_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uk_relation" UNIQUE("relation","resource_id","resource_type","subject_id","subject_type")
);
--> statement-breakpoint
CREATE TABLE "repo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"provider" "provider" NOT NULL,
	"provider_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uk_repo_account_name" UNIQUE("account_id","name"),
	CONSTRAINT "uk_repo_provider_id" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
ALTER TABLE "repo" ADD CONSTRAINT "repo_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tuple_resource" ON "relation" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_tuple_subject" ON "relation" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."mv_user_repo_permissions" AS (
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
);