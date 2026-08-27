CREATE TYPE "public"."assistant_mode" AS ENUM('browse', 'review', 'verify');--> statement-breakpoint
ALTER TABLE "criterion" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "not_built" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "prototype" ADD COLUMN "mode" "assistant_mode" DEFAULT 'review' NOT NULL;--> statement-breakpoint
ALTER TABLE "version" ADD COLUMN "scenario" text;