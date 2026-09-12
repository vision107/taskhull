CREATE TABLE "build" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"template_version_id" uuid,
	"serial_number" text NOT NULL,
	"name" text,
	"description" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"planned_start_date" date,
	"planned_end_date" date,
	"actual_started_at" timestamp with time zone,
	"actual_completed_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"build_id" uuid,
	"build_task_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"assigned_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_task_id" uuid NOT NULL,
	"template_document_id" uuid,
	"uploaded_by_id" uuid,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_by_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task_dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_task_id" uuid NOT NULL,
	"depends_on_build_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"build_id" uuid NOT NULL,
	"source_template_task_id" uuid,
	"title" text NOT NULL,
	"instructions" text,
	"phase" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"planned_duration_days" integer DEFAULT 1 NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'todo' NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"actual_started_at" timestamp with time zone,
	"actual_completed_at" timestamp with time zone,
	"completed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changed_by_id" uuid,
	"snapshot" jsonb,
	"previous_snapshot" jsonb,
	"changed_fields" jsonb,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_task_checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_task_dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_task_id" uuid NOT NULL,
	"depends_on_template_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_task_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_task_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"phase" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"requires_photo" boolean DEFAULT false NOT NULL,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"change_note" text,
	"published_at" timestamp with time zone,
	"published_by_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_template_version_id_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_activity" ADD CONSTRAINT "build_task_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_activity" ADD CONSTRAINT "build_task_activity_build_id_build_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."build"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_activity" ADD CONSTRAINT "build_task_activity_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_activity" ADD CONSTRAINT "build_task_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_assignment" ADD CONSTRAINT "build_task_assignment_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_assignment" ADD CONSTRAINT "build_task_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_assignment" ADD CONSTRAINT "build_task_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_attachment" ADD CONSTRAINT "build_task_attachment_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_attachment" ADD CONSTRAINT "build_task_attachment_template_document_id_template_task_document_id_fk" FOREIGN KEY ("template_document_id") REFERENCES "public"."template_task_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_attachment" ADD CONSTRAINT "build_task_attachment_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_checklist_item" ADD CONSTRAINT "build_task_checklist_item_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_checklist_item" ADD CONSTRAINT "build_task_checklist_item_completed_by_id_user_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_comment" ADD CONSTRAINT "build_task_comment_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_comment" ADD CONSTRAINT "build_task_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_dependency" ADD CONSTRAINT "build_task_dependency_build_task_id_build_task_id_fk" FOREIGN KEY ("build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task_dependency" ADD CONSTRAINT "build_task_dependency_depends_on_build_task_id_build_task_id_fk" FOREIGN KEY ("depends_on_build_task_id") REFERENCES "public"."build_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task" ADD CONSTRAINT "build_task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task" ADD CONSTRAINT "build_task_build_id_build_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."build"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task" ADD CONSTRAINT "build_task_source_template_task_id_template_task_id_fk" FOREIGN KEY ("source_template_task_id") REFERENCES "public"."template_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_task" ADD CONSTRAINT "build_task_completed_by_id_user_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision" ADD CONSTRAINT "revision_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision" ADD CONSTRAINT "revision_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task_checklist_item" ADD CONSTRAINT "template_task_checklist_item_template_task_id_template_task_id_fk" FOREIGN KEY ("template_task_id") REFERENCES "public"."template_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task_dependency" ADD CONSTRAINT "template_task_dependency_template_task_id_template_task_id_fk" FOREIGN KEY ("template_task_id") REFERENCES "public"."template_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task_dependency" ADD CONSTRAINT "template_task_dependency_depends_on_template_task_id_template_task_id_fk" FOREIGN KEY ("depends_on_template_task_id") REFERENCES "public"."template_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task_document" ADD CONSTRAINT "template_task_document_template_task_id_template_task_id_fk" FOREIGN KEY ("template_task_id") REFERENCES "public"."template_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task_document" ADD CONSTRAINT "template_task_document_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_task" ADD CONSTRAINT "template_task_version_id_template_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."template_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_version" ADD CONSTRAINT "template_version_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_version" ADD CONSTRAINT "template_version_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_version" ADD CONSTRAINT "template_version_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_organization_id_idx" ON "build" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "build_product_id_idx" ON "build" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "build_template_version_id_idx" ON "build" USING btree ("template_version_id");--> statement-breakpoint
CREATE INDEX "build_status_idx" ON "build" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "build_product_serial_idx" ON "build" USING btree ("product_id","serial_number");--> statement-breakpoint
CREATE INDEX "build_task_activity_organization_id_idx" ON "build_task_activity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "build_task_activity_build_id_idx" ON "build_task_activity" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "build_task_activity_task_id_idx" ON "build_task_activity" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_activity_created_at_idx" ON "build_task_activity" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "build_task_assignment_unique_idx" ON "build_task_assignment" USING btree ("build_task_id","user_id","role");--> statement-breakpoint
CREATE INDEX "build_task_assignment_task_id_idx" ON "build_task_assignment" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_assignment_user_id_idx" ON "build_task_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "build_task_attachment_task_id_idx" ON "build_task_attachment" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_attachment_uploaded_by_id_idx" ON "build_task_attachment" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "build_task_checklist_item_task_id_idx" ON "build_task_checklist_item" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_comment_task_id_idx" ON "build_task_comment" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_comment_author_id_idx" ON "build_task_comment" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "build_task_dependency_unique_idx" ON "build_task_dependency" USING btree ("build_task_id","depends_on_build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_dependency_task_id_idx" ON "build_task_dependency" USING btree ("build_task_id");--> statement-breakpoint
CREATE INDEX "build_task_organization_id_idx" ON "build_task" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "build_task_build_id_idx" ON "build_task" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "build_task_source_template_task_id_idx" ON "build_task" USING btree ("source_template_task_id");--> statement-breakpoint
CREATE INDEX "build_task_status_idx" ON "build_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_task_dates_idx" ON "build_task" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "product_organization_id_idx" ON "product" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_template_id_idx" ON "product" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "revision_organization_id_idx" ON "revision" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "revision_entity_idx" ON "revision" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "revision_created_at_idx" ON "revision" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "template_organization_id_idx" ON "template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "template_archived_at_idx" ON "template" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "template_task_checklist_item_task_id_idx" ON "template_task_checklist_item" USING btree ("template_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_task_dependency_unique_idx" ON "template_task_dependency" USING btree ("template_task_id","depends_on_template_task_id");--> statement-breakpoint
CREATE INDEX "template_task_dependency_task_id_idx" ON "template_task_dependency" USING btree ("template_task_id");--> statement-breakpoint
CREATE INDEX "template_task_document_task_id_idx" ON "template_task_document" USING btree ("template_task_id");--> statement-breakpoint
CREATE INDEX "template_task_version_id_idx" ON "template_task" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "template_task_sort_order_idx" ON "template_task" USING btree ("version_id","sort_order");--> statement-breakpoint
CREATE INDEX "template_version_template_id_idx" ON "template_version" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_version_status_idx" ON "template_version" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "template_version_template_number_idx" ON "template_version" USING btree ("template_id","version_number");