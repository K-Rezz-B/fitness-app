CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}' NOT NULL,
	"device_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "api_token" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "notify_streak" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "notify_weekly" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "notify_badges" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pending_workout_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pending_workout_type" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_profile_id_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkeys_profile_idx" ON "passkeys" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "push_profile_idx" ON "push_subscriptions" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_profile_external_idx" ON "workouts" USING btree ("profile_id","external_id");--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_api_token_unique" UNIQUE("api_token");