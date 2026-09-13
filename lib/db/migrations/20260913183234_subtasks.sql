ALTER TABLE "build_task" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
ALTER TABLE "template_task" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
ALTER TABLE "build_task" ADD CONSTRAINT "build_task_parent_task_id_build_task_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task" ADD CONSTRAINT "template_task_parent_task_id_template_task_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."template_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_task_parent_task_id_idx" ON "build_task" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "template_task_parent_task_id_idx" ON "template_task" USING btree ("parent_task_id");