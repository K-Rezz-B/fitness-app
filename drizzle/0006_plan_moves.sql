CREATE TABLE "plan_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"plan_id" integer,
	"from_date" date NOT NULL,
	"to_date" date,
	"to_time" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"duration_min" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"template_id" text,
	"rpe" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_moves" ADD CONSTRAINT "plan_moves_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_moves" ADD CONSTRAINT "plan_moves_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_moves_profile_idx" ON "plan_moves" USING btree ("profile_id","to_date");