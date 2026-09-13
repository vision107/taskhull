ALTER TABLE "build" DROP CONSTRAINT "build_product_id_product_id_fk";
--> statement-breakpoint
DROP INDEX "build_product_serial_idx";--> statement-breakpoint
ALTER TABLE "build" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "build_task_attachment" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
UPDATE "build_task_attachment" SET "kind" = 'document' WHERE "template_document_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "build_org_serial_idx" ON "build" USING btree ("organization_id","serial_number");