CREATE TABLE "project_favorite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "template_project_id" uuid;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "template_task_id" uuid;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "actual_hours" double precision;--> statement-breakpoint
ALTER TABLE "project_favorite" ADD CONSTRAINT "project_favorite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_favorite" ADD CONSTRAINT "project_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_favorite_unique_idx" ON "project_favorite" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "project_favorite_user_id_idx" ON "project_favorite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_template_project_id_idx" ON "project" USING btree ("template_project_id");--> statement-breakpoint
CREATE INDEX "task_template_task_id_idx" ON "task" USING btree ("template_task_id");