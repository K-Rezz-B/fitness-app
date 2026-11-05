ALTER TABLE "profile" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pin_failed_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pin_locked_until" timestamp with time zone;