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
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type ExerciseSet = { reps?: number; weight?: number };
export type Exercise = { name: string; sets: ExerciseSet[] };

/** Profils (un mot de passe commun, plusieurs personnes, chacun verrouillé par son code). Toutes les données sont rattachées à un profil. */
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
  /** Jeton secret des intégrations (Raccourcis, widget) — null = désactivé */
  apiToken: text("api_token").unique(),
  notifyStreak: boolean("notify_streak").notNull().default(true),
  notifyWeekly: boolean("notify_weekly").notNull().default(true),
  notifyBadges: boolean("notify_badges").notNull().default(true),
  /** Apparaît dans le classement des défis entre profils (et peut voir celui des autres) */
  shareChallenges: boolean("share_challenges").notNull().default(false),
  /** Début d'exercice Apple Watch reçu, en attente du signal de fin */
  pendingWorkoutStart: timestamp("pending_workout_start", { withTimezone: true }),
  pendingWorkoutType: text("pending_workout_type"),
  // --- Coach planificateur (questionnaire) ---
  planDays: smallint("plan_days").array().notNull().default([]), // jours dispo, 1 = lundi
  planTime: text("plan_time").notNull().default("18:30"),
  planSessionMin: smallint("plan_session_min").notNull().default(45),
  planEquipment: text("plan_equipment").notNull().default("gym"), // gym | home | bodyweight
  planLevel: text("plan_level").notNull().default("beginner"), // beginner | intermediate | advanced
  planSports: text("plan_sports").array().notNull().default([]),
  planAuto: boolean("plan_auto").notNull().default(true), // re-planifie chaque dimanche
  planCycleStart: date("plan_cycle_start"), // lundi de la 1re semaine du cycle de 4 semaines
  planNotes: text("plan_notes").array().notNull().default([]), // explications de la semaine générée
  planEasy: boolean("plan_easy").notNull().default(false), // semaine allégée (décharge / surcharge / reprise)
  // --- Objectifs d'activité quotidienne (app Forme) ---
  moveGoalKcal: smallint("move_goal_kcal").notNull().default(400),
  stepsGoal: smallint("steps_goal").notNull().default(8000),
  // --- Verrouillage du profil (code PIN, ou Face ID via une passkey) ---
  /** Empreinte PBKDF2 du code (jamais en clair, ne jamais l'envoyer au navigateur). null = profil créé avant le verrou */
  pinHash: text("pin_hash"),
  pinFailedAttempts: smallint("pin_failed_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
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
  source: text("source").notNull().default("manual"), // manual | apple-health
  /** Clé de dédoublonnage des imports (même séance envoyée 2 fois) */
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("workouts_profile_date_idx").on(t.profileId, t.date),
  uniqueIndex("workouts_profile_external_idx").on(t.profileId, t.externalId),
]);

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
  source: text("source").notNull().default("manual"), // manual | coach
  templateId: text("template_id"), // programme prescrit par le coach
  rpe: smallint("rpe"), // intensité visée
  notes: text("notes"), // pourquoi cette séance
  weekStart: date("week_start"), // semaine pour laquelle le coach l'a générée
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("plans_profile_idx").on(t.profileId)]);

/** Activité quotidienne importée d'Apple Santé (app Forme) : pas, énergie active, distance… */
export const dailyActivity = pgTable("daily_activity", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  date: date("date").notNull(),
  steps: integer("steps"),
  activeKcal: integer("active_kcal"),
  distanceKm: real("distance_km"),
  exerciseMin: integer("exercise_min"),
  standHours: smallint("stand_hours"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("daily_activity_profile_date_idx").on(t.profileId, t.date)]);

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

/** Abonnements Web Push (un par appareil / navigateur) */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  profileId: profileId(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("push_profile_idx").on(t.profileId)]);

/** Passkeys (Face ID / Touch ID, synchronisées par le trousseau iCloud). Se connecter avec ouvre le profil associé. */
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(), // identifiant de la credential (base64url)
  profileId: profileId(),
  publicKey: text("public_key").notNull(), // clé publique COSE (base64url)
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: text("transports").array().notNull().default([]),
  deviceName: text("device_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (t) => [index("passkeys_profile_idx").on(t.profileId)]);

export type Profile = typeof profile.$inferSelect;
export type Weight = typeof weights.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;
export type DailyActivity = typeof dailyActivity.$inferSelect;
