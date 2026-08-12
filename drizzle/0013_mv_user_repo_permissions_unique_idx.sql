CREATE UNIQUE INDEX "mv_user_repo_permissions_user_id_repo_id_idx" ON "public"."mv_user_repo_permissions" USING btree ("user_id","repo_id");--> statement-breakpoint
