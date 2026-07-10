ALTER TABLE "results" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_share_token_unique" UNIQUE("share_token");