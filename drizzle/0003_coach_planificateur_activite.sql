CREATE TABLE "daily_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"date" date NOT NULL,
	"steps" integer,
	"active_kcal" integer,
	"distance_km" real,
	"exercise_min" integer,
	"stand_hours" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "rpe" smallint;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "week_start" date;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_days" smallint[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_time" text DEFAULT '18:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_session_min" smallint DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_equipment" text DEFAULT 'gym' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_level" text DEFAULT 'beginner' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_sports" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_auto" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_cycle_start" date;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_notes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_easy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "move_goal_kcal" smallint DEFAULT 400 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "steps_goal" smallint DEFAULT 8000 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_activity_profile_date_idx" ON "daily_activity" USING btree ("profile_id","date");