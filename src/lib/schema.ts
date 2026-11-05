import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  jsonb,
  smallint,
  index,
} from "drizzle-orm/pg-core";

export type ExerciseSet = { reps?: number; weight?: number };
export type Exercise = { name: string; sets: ExerciseSet[] };

/** Profils (un mot de passe commun, plusieurs personnes). Toutes les données sont rattachées à un profil. */
export const profile = pgTable("profile", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().default(""),
  emoji: text("emoji").notNull().default("💪"),
  sex: text("sex").notNull().default("male"), // male | female
  birthDate: date("birth_date"),
  heightCm: real("height_cm"),
  activityLevel: text("activity_level").notNull().default("moderate"),
  goal: text("goal").notNull().default("maintain"), // lose | maintain | gain | performance
  targetWeightKg: real("target_weight_kg"),
  weeklySessionsTarget: smallint("weekly_sessions_target").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Propriétaire de la ligne : supprimer un profil supprime ses données. */
const profileId = () =>
  integer("profile_id")
    .notNull()
    .references(() => profile.id, { onDelete: "cascade" });

export const weights = pgTable("weights", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  date: date("date").notNull(),
  weightKg: real("weight_kg").notNull(),
  bodyFatPct: real("body_fat_pct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("weights_profile_date_idx").on(t.profileId, t.date)]);

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  durationMin: integer("duration_min").notNull(),
  rpe: smallint("rpe").notNull().default(6), // effort perçu 1-10
  distanceKm: real("distance_km"),
  calories: integer("calories"),
  exercises: jsonb("exercises").$type<Exercise[]>().notNull().default([]),
  notes: text("notes"),
  videoId: integer("video_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("workouts_profile_date_idx").on(t.profileId, t.date)]);

/** Séances planifiées récurrentes (hebdo) → exportées en flux .ics */
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  weekday: smallint("weekday").notNull(), // 1 = lundi ... 7 = dimanche (ISO)
  time: text("time").notNull(), // "HH:MM"
  durationMin: integer("duration_min").notNull().default(60),
  reminderMin: integer("reminder_min").notNull().default(30),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("plans_profile_idx").on(t.profileId)]);

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull().default("web"),
  tags: text("tags").array().notNull().default([]),
  type: text("type"),
  durationMin: integer("duration_min"),
  notes: text("notes"),
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("videos_profile_idx").on(t.profileId)]);

export type Profile = typeof profile.$inferSelect;
export type Weight = typeof weights.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Video = typeof videos.$inferSelect;
