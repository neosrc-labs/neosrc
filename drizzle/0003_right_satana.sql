CREATE TABLE "pull_request_report" (
	"provider" varchar(64) NOT NULL,
	"repositorySlug" varchar(255) NOT NULL,
	"prNumber" integer NOT NULL,
	"revision" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"commitSha" varchar(40),
	"type" varchar(64) NOT NULL,
	"data" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pull_request_report_provider_repositorySlug_prNumber_name_revision_pk" PRIMARY KEY("provider","repositorySlug","prNumber","name","revision")
);
