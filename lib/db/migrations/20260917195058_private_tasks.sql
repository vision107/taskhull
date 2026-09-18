CREATE TABLE "private_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"build_task_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "private_task" ADD CONSTRAINT "private_task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_task" ADD CONSTRAINT "private_task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_task" ADD CONSTRAINT "private_task_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "private_task_org_user_idx" ON "private_task" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "private_task_build_task_id_idx" ON "private_task" USING btree ("build_task_id");