ALTER TABLE "projects" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
UPDATE "projects" SET "owner_id" = (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;