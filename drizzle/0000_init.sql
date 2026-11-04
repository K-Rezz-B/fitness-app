CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"weekday" smallint NOT NULL,
	"time" text NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"reminder_min" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"sex" text DEFAULT 'male' NOT NULL,
	"birth_date" date,
	"height_cm" real,
	"activity_level" text DEFAULT 'moderate' NOT NULL,
	"goal" text DEFAULT 'maintain' NOT NULL,
	"target_weight_kg" real,
	"weekly_sessions_target" smallint DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"platform" text DEFAULT 'web' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"type" text,
	"duration_min" integer,
	"notes" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL,
	"body_fat_pct" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"duration_min" integer NOT NULL,
	"rpe" smallint DEFAULT 6 NOT NULL,
	"distance_km" real,
	"calories" integer,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"video_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
