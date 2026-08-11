ALTER TABLE "sync_state" RENAME TO "permissions_sync_state";--> statement-breakpoint
ALTER TABLE "permissions_sync_state" DROP CONSTRAINT "sync_state_user_id_ba_user_id_fk";
--> statement-breakpoint
ALTER TABLE "permissions_sync_state" DROP CONSTRAINT "sync_state_provider_user_id_pk";--> statement-breakpoint
ALTER TABLE "permissions_sync_state" ADD CONSTRAINT "permissions_sync_state_provider_user_id_pk" PRIMARY KEY("provider","user_id");--> statement-breakpoint
ALTER TABLE "permissions_sync_state" ADD CONSTRAINT "permissions_sync_state_user_id_ba_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ba_user"("id") ON DELETE no action ON UPDATE no action;