CREATE TABLE "api_key" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"owner" text NOT NULL,
	"expirationTimestamp" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(64) NOT NULL,
	"apiKeyId" integer NOT NULL,
	"target" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_owner_ba_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."ba_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_permission" ADD CONSTRAINT "api_key_permission_apiKeyId_api_key_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action;