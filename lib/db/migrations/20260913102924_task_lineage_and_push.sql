CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "template_task" ADD COLUMN "lineage_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscription_endpoint_idx" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "template_task_lineage_id_idx" ON "template_task" USING btree ("lineage_id");--> statement-breakpoint
-- Backfill: tasks that were copied into later versions before lineage existed
-- share the lineage of the earliest task with the same title in that template.
UPDATE "template_task" t
SET "lineage_id" = src."lineage_id"
FROM "template_version" v,
(
	SELECT DISTINCT ON (tv."template_id", lower(tt."title"))
		tv."template_id", lower(tt."title") AS title_key, tt."lineage_id"
	FROM "template_task" tt
	JOIN "template_version" tv ON tv."id" = tt."version_id"
	ORDER BY tv."template_id", lower(tt."title"), tv."version_number" ASC, tt."created_at" ASC
) src
WHERE v."id" = t."version_id"
	AND v."template_id" = src."template_id"
	AND lower(t."title") = src.title_key
	AND t."lineage_id" <> src."lineage_id";
