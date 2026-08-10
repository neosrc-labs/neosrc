CREATE INDEX "api_key_owner_idx" ON "api_key" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "api_key_permission_apiKeyId_idx" ON "api_key_permission" USING btree ("apiKeyId");--> statement-breakpoint
CREATE INDEX "ba_account_userId_idx" ON "ba_account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ba_session_userId_idx" ON "ba_session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cache_deleteAt_idx" ON "cache" USING btree ("deleteAt");