CREATE TYPE "public"."ac_result_value" AS ENUM('met', 'not_met', 'needs_discussion', 'not_verifiable');--> statement-breakpoint
CREATE TYPE "public"."annotation_kind" AS ENUM('select', 'point', 'draw');--> statement-breakpoint
CREATE TYPE "public"."disposition" AS ENUM('done', 'wont_do', 'deferred', 'needs_discussion');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('blocker', 'major', 'minor', 'preference', 'new_request');--> statement-breakpoint
CREATE TYPE "public"."version_type" AS ENUM('revision', 'option');--> statement-breakpoint
CREATE TABLE "ac_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"result" "ac_result_value" NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "annotation_kind" NOT NULL,
	"screen_id" text,
	"css_selector" text,
	"coords_json" jsonb,
	"screenshot_blob_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"ref" text,
	"text" text NOT NULL,
	"where_found" text,
	"verifiable_in_prototype" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"annotation_id" uuid,
	"screen_id" text,
	"task_id" uuid,
	"criterion_id" uuid,
	"expected" text,
	"happened" text,
	"note" text,
	"severity" "severity" DEFAULT 'minor' NOT NULL,
	"disposition" "disposition",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "not_built" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prototype" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ticket" text,
	"description" text,
	"password_hash" text NOT NULL,
	"reviewer_names" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"reviewer_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"goal" text NOT NULL,
	"success_state" text
);
--> statement-breakpoint
CREATE TABLE "version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prototype_id" uuid NOT NULL,
	"label" text NOT NULL,
	"changed_note" text,
	"html_blob_url" text NOT NULL,
	"knowledge_base_text" text,
	"type" "version_type" DEFAULT 'revision' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ac_result" ADD CONSTRAINT "ac_result_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ac_result" ADD CONSTRAINT "ac_result_criterion_id_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criterion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_annotation_id_annotation_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_criterion_id_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criterion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "not_built" ADD CONSTRAINT "not_built_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_version_id_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version" ADD CONSTRAINT "version_prototype_id_prototype_id_fk" FOREIGN KEY ("prototype_id") REFERENCES "public"."prototype"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ac_result_session_criterion_idx" ON "ac_result" USING btree ("session_id","criterion_id");--> statement-breakpoint
CREATE INDEX "annotation_session_id_idx" ON "annotation" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "criterion_version_id_idx" ON "criterion" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "feedback_session_id_idx" ON "feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "feedback_annotation_id_idx" ON "feedback" USING btree ("annotation_id");--> statement-breakpoint
CREATE INDEX "feedback_severity_idx" ON "feedback" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "message_session_id_idx" ON "message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "not_built_version_id_idx" ON "not_built" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "session_version_id_idx" ON "session" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "task_version_id_idx" ON "task" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "version_prototype_id_idx" ON "version" USING btree ("prototype_id");--> statement-breakpoint
CREATE UNIQUE INDEX "version_one_current_per_prototype_idx" ON "version" USING btree ("prototype_id") WHERE "version"."is_current";