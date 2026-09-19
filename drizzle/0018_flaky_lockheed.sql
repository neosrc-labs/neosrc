CREATE TYPE "public"."auth_connection_status" AS ENUM('active', 'reauth_required');--> statement-breakpoint
ALTER TABLE "ba_account" ADD COLUMN "connectionStatus" "auth_connection_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "ba_account" ADD COLUMN "credentialVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ba_account" ADD COLUMN "lastRefreshedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ba_account" ADD COLUMN "lastAuthError" text;