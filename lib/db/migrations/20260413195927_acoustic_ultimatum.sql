CREATE TABLE "label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"icon" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_key" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"predecessor_id" uuid NOT NULL,
	"successor_id" uuid NOT NULL,
	"type" text DEFAULT 'finish_to_start' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"type" text DEFAULT 'todo' NOT NULL,
	"order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status_id" uuid,
	"title" text NOT NULL,
	"description" jsonb,
	"priority" text DEFAULT 'none' NOT NULL,
	"assignee_id" uuid,
	"parent_id" uuid,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimated_hours" double precision,
	"sequence_id" integer DEFAULT 0 NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_predecessor_id_task_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_successor_id_task_id_fk" FOREIGN KEY ("successor_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_label" ADD CONSTRAINT "task_label_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_label" ADD CONSTRAINT "task_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_status" ADD CONSTRAINT "task_status_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_status_id_task_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."task_status"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_project_id_idx" ON "label" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "label_project_name_idx" ON "label" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_unique_idx" ON "project_member" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_member_project_id_idx" ON "project_member" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_member_user_id_idx" ON "project_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_organization_id_idx" ON "project" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_org_status_idx" ON "project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "task_activity_task_id_idx" ON "task_activity" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_activity_task_created_idx" ON "task_activity" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_attachment_task_id_idx" ON "task_attachment" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_comment_task_id_idx" ON "task_comment" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_comment_user_id_idx" ON "task_comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_comment_created_at_idx" ON "task_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependency_unique_idx" ON "task_dependency" USING btree ("predecessor_id","successor_id");--> statement-breakpoint
CREATE INDEX "task_dependency_predecessor_idx" ON "task_dependency" USING btree ("predecessor_id");--> statement-breakpoint
CREATE INDEX "task_dependency_successor_idx" ON "task_dependency" USING btree ("successor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_label_unique_idx" ON "task_label" USING btree ("task_id","label_id");--> statement-breakpoint
CREATE INDEX "task_label_task_id_idx" ON "task_label" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_status_project_id_idx" ON "task_status" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_status_project_order_idx" ON "task_status" USING btree ("project_id","order");--> statement-breakpoint
CREATE INDEX "task_project_id_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_status_id_idx" ON "task" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "task_assignee_id_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "task_parent_id_idx" ON "task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_due_date_idx" ON "task" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "task_start_date_idx" ON "task" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "task_project_sequence_idx" ON "task" USING btree ("project_id","sequence_id");--> statement-breakpoint
CREATE INDEX "task_project_sort_idx" ON "task" USING btree ("project_id","sort_order");