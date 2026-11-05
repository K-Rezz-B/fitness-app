export type Category = "force" | "cardio" | "mobilite";

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  // Palette catégorielle validée (dark, CVD-safe, 3 slots all-pairs)
  force: { label: "Force", color: "#3987e5" },
  cardio: { label: "Cardio", color: "#d95926" },
  mobilite: { label: "Mobilité", color: "#199e70" },
};

export type WorkoutType = {
  id: string;
  label: string;
  emoji: string;
  category: Category;
  /** MET moyen (Compendium of Physical Activities, Ainsworth 2011) */
  met: number;
  hasDistance?: boolean;
};

export const WORKOUT_TYPES: WorkoutType[] = [
  { id: "muscu", label: "Musculation", emoji: "🏋️", category: "force", met: 5 },
  { id: "calisthenics", label: "Poids du corps", emoji: "🤸", category: "force", met: 4.5 },
  { id: "crossfit", label: "Functional / Cross", emoji: "🔥", category: "force", met: 8 },
  { id: "hiit", label: "HIIT", emoji: "⚡", category: "cardio", met: 8 },
  { id: "course", label: "Course", emoji: "🏃", category: "cardio", met: 9.8, hasDistance: true },
  { id: "velo", label: "Vélo", emoji: "🚴", category: "cardio", met: 7.5, hasDistance: true },
  { id: "natation", label: "Natation", emoji: "🏊", category: "cardio", met: 7, hasDistance: true },
  { id: "marche", label: "Marche / Rando", emoji: "🥾", category: "cardio", met: 4.3, hasDistance: true },
  { id: "boxe", label: "Boxe / Combat", emoji: "🥊", category: "cardio", met: 9 },
  { id: "sport", label: "Sport collectif", emoji: "⚽", category: "cardio", met: 7 },
  { id: "cardio", label: "Cardio (autre)", emoji: "❤️‍🔥", category: "cardio", met: 6 },
  { id: "yoga", label: "Yoga", emoji: "🧘", category: "mobilite", met: 2.8 },
  { id: "mobilite", label: "Mobilité / Stretching", emoji: "🌀", category: "mobilite", met: 2.3 },
];

export const TYPE_BY_ID = Object.fromEntries(WORKOUT_TYPES.map((t) => [t.id, t]));

export function typeInfo(id: string): WorkoutType {
  return (
    TYPE_BY_ID[id] ?? { id, label: id, emoji: "💪", category: "force", met: 5 }
  );
}

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const ACTIVITY_LEVELS = {
  sedentary: { label: "Sédentaire (bureau, peu de marche)", factor: 1.2 },
  light: { label: "Légèrement actif (1-3 j/sem)", factor: 1.375 },
  moderate: { label: "Modérément actif (3-5 j/sem)", factor: 1.55 },
  active: { label: "Très actif (6-7 j/sem)", factor: 1.725 },
  athlete: { label: "Athlète (2x/jour, métier physique)", factor: 1.9 },
} as const;

export const GOALS = {
  lose: "Perdre du gras",
  maintain: "Maintenir / Santé",
  gain: "Prendre du muscle",
  performance: "Performance",
} as const;

export const TZ = process.env.APP_TIMEZONE ?? "Europe/Paris";

/** Avatars proposés pour les profils */
export const PROFILE_EMOJIS = ["💪", "🏃", "🚴", "🏊", "🧘", "🥊", "⚽", "🎾", "🔥", "⚡", "🦁", "🐺"];
