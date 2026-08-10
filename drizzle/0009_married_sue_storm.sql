CREATE TABLE "sync_state" (
	"provider" "provider" NOT NULL,
	"user_id" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_provider_user_id_pk" PRIMARY KEY("provider","user_id")
);
--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_user_id_ba_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ba_user"("id") ON DELETE no action ON UPDATE no action;