ALTER TABLE "build" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "build" (
	"organization_id",
	"owner_user_id",
	"created_by_id",
	"serial_number",
	"name",
	"status",
	"planned_start_date"
)
SELECT
	pt.organization_id,
	pt.user_id,
	pt.user_id,
	'~list-' || pt.user_id::text,
	'My list',
	'active',
	CURRENT_DATE
FROM (SELECT DISTINCT organization_id, user_id FROM "private_task") pt
WHERE NOT EXISTS (
	SELECT 1 FROM "build" b
	WHERE b.organization_id = pt.organization_id
		AND b.owner_user_id = pt.user_id
);--> statement-breakpoint
INSERT INTO "build_task" (
	"id",
	"organization_id",
	"build_id",
	"title",
	"instructions",
	"sort_order",
	"planned_duration_days",
	"start_date",
	"end_date",
	"status",
	"actual_completed_at",
	"completed_by_id",
	"created_at",
	"updated_at"
)
SELECT
	pt.id,
	pt.organization_id,
	b.id,
	pt.title,
	pt.notes,
	(EXTRACT(EPOCH FROM pt.created_at)::int % 1000000),
	1,
	pt.due_date,
	pt.due_date,
	CASE WHEN pt.completed_at IS NULL THEN 'todo' ELSE 'done' END,
	pt.completed_at,
	CASE WHEN pt.completed_at IS NULL THEN NULL ELSE pt.user_id END,
	pt.created_at,
	pt.updated_at
FROM "private_task" pt
INNER JOIN "build" b
	ON b.organization_id = pt.organization_id
	AND b.owner_user_id = pt.user_id;--> statement-breakpoint
INSERT INTO "build_task_assignment" (
	"build_task_id",
	"user_id",
	"role",
	"assigned_by_id"
)
SELECT
	pt.id,
	pt.user_id,
	'owner',
	pt.user_id
FROM "private_task" pt;--> statement-breakpoint
CREATE UNIQUE INDEX "build_org_personal_owner_idx" ON "build" USING btree ("organization_id","owner_user_id") WHERE "build"."owner_user_id" is not null;--> statement-breakpoint
ALTER TABLE "private_task" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "private_task" CASCADE;
