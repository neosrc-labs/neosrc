ALTER TABLE "ba_account" DROP CONSTRAINT "ba_account_userId_ba_user_id_fk";
--> statement-breakpoint
DROP INDEX "ba_account_userId_idx";--> statement-breakpoint
ALTER TABLE "ba_account" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "ba_account" AS "account" SET "username" = CASE "account"."providerId" WHEN 'github' THEN "user"."githubUsername" WHEN 'codeberg' THEN "user"."codebergUsername" ELSE NULL END FROM "ba_user" AS "user" WHERE "account"."userId" = "user"."id" AND "account"."providerId" IN ('github', 'codeberg');--> statement-breakpoint
ALTER TABLE "ba_account" ADD CONSTRAINT "ba_account_userId_ba_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."ba_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ba_user" DROP COLUMN "githubUsername";--> statement-breakpoint
ALTER TABLE "ba_user" DROP COLUMN "codebergUsername";--> statement-breakpoint
ALTER TABLE "ba_account" ADD CONSTRAINT "ba_account_userId_providerId_unique" UNIQUE("userId","providerId");--> statement-breakpoint
ALTER TABLE "ba_account" ADD CONSTRAINT "ba_account_providerId_accountId_unique" UNIQUE("providerId","accountId");