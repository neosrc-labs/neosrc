CREATE TYPE "public"."repo_visibility" AS ENUM('private', 'public');--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "visibility" "repo_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "stars" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "watchers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "forks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "default_branch" varchar(255);--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;