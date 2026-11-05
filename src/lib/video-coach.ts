// Le coach choisit la vidéo de la séance : il pioche parmi les vidéos dont les tags correspondent
// au thème du programme (full body, haut du corps, HIIT…), puis départage selon le matériel, le niveau,
// la durée, les favoris et les vidéos suivies récemment (pour varier). Fonctions pures.
import { typeInfo } from "./constants";
import { addDays, dayKey } from "./dates";
import { templateNeeds, type Equipment, type Level } from "./planner";
import type { Profile, Video, Workout } from "./schema";
import { CHANNELS, VIDEO_CATALOG, catalogUrl } from "./video-catalog";
import { youtubeId } from "./video";

/** Vidéo de la vidéothèque (id) ou de la sélection pas encore importée (id null). */
export type CoachVideo = Pick<Video, "url" | "title" | "tags" | "type" | "durationMin" | "favorite" | "notes"> & { id: number | null };
export type VideoPick = CoachVideo & {
  /** Tags du thème de la séance portés par la vidéo */
  matched: string[];
  /** Vidéo de retour au calme : à faire après la séance (course, natation, force…) */
  cooldown: boolean;
};
export type CoachSession = { templateId?: string | null; type: string; durationMin: number };
export type CoachVideoResult = { theme: string[]; picks: VideoPick[]; fromCatalog: boolean };

/** Thème vidéo de chaque programme : tags recherchés, du plus important au moins important. */
const TEMPLATE_THEME: Record<string, string[]> = {
  "fullbody-a": ["full body"], "fullbody-b": ["full body"], "db-fullbody-a": ["full body"], "db-fullbody-b": ["full body"], "bw-fullbody": ["full body"],
  "bw-circuit": ["full body", "hiit"],
  push: ["haut du corps"], upper: ["haut du corps"], "upper-b": ["haut du corps"], "db-upper": ["haut du corps"], "bw-upper": ["haut du corps"],
  pull: ["haut du corps", "dos"],
  legs: ["jambes", "fessiers"], "lower-b": ["jambes", "fessiers"], "db-lower": ["jambes", "fessiers"], "bw-lower": ["jambes", "fessiers"],
  wod: ["hiit", "full body"], emom: ["hiit", "cardio"], tabata: ["hiit", "cardio"],
  ef: ["course", "récup", "étirements"], fractionne: ["course", "récup", "étirements"], "sortie-longue": ["course", "récup", "étirements"],
  "velo-z2": ["vélo", "récup"], "velo-sst": ["vélo", "récup"],
  nage: ["natation", "récup", "étirements"],
  rando: ["marche", "récup", "étirements"],
  boxe: ["boxe", "cardio"],
  "yoga-flow": ["yoga"],
  mobility: ["mobilité", "étirements", "récup"],
};

/** Séances sans programme (créneaux perso) : thème déduit du type. */
const TYPE_THEME: Record<string, string[]> = {
  muscu: ["full body"], calisthenics: ["full body", "sans matériel"], crossfit: ["hiit", "full body"], hiit: ["hiit", "cardio"],
  course: ["course", "récup", "étirements"], velo: ["vélo", "récup"], natation: ["natation", "récup", "étirements"],
  marche: ["marche", "récup", "étirements"], boxe: ["boxe", "cardio"], sport: ["cardio", "récup"], cardio: ["cardio", "hiit"],
  yoga: ["yoga"], mobilite: ["mobilité", "étirements", "récup"],
};

export const themeOf = (s: CoachSession): string[] =>
  (s.templateId && TEMPLATE_THEME[s.templateId]) || TYPE_THEME[s.type] || [typeInfo(s.type).label.toLowerCase()];

const COOLDOWN_TAGS = ["récup", "étirements"];
const ZONE_TAGS = ["full body", "haut du corps", "jambes", "fessiers", "dos", "abdos"];
const isCooldown = (v: Pick<CoachVideo, "tags">) => v.tags.some((t) => COOLDOWN_TAGS.includes(t));

export type CoachVideoContext = {
  equipment: Equipment | null; // matériel du profil (null = questionnaire pas rempli)
  level: Level | null;
  recentVideoIds: number[]; // vidéos suivies ces 14 derniers jours → on varie
  seed: number; // change chaque jour : rotation entre vidéos équivalentes, stable dans la journée
};

/** Matériel de la séance : celui du programme s'il en impose un, sinon celui du profil. */
function gearOf(s: CoachSession, equipment: Equipment | null): Equipment | null {
  const needs = s.templateId ? templateNeeds(s.templateId) : "none";
  if (needs === "gym") return "gym";
  if (needs === "dumbbells") return "home";
  if (s.type === "calisthenics") return "bodyweight";
  return equipment;
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;

function scoreVideo(v: CoachVideo, s: CoachSession, theme: string[], gear: Equipment | null, ctx: CoachVideoContext) {
  const has = (t: string) => v.tags.includes(t);
  const matched = theme.filter(has);
  const sameType = !!v.type && v.type === s.type;
  // Sans tag du thème, le type seul suffit… sauf si la vidéo cible une autre zone (ex. « jambes » pour un haut du corps)
  if (!matched.length && !(sameType && !v.tags.some((t) => ZONE_TAGS.includes(t)))) return null;
  if (gear === "bodyweight" && (has("haltères") || has("barre"))) return null;
  if (ctx.level === "beginner" && has("avancé")) return null;

  const cooldown = isCooldown(v) && typeInfo(s.type).category !== "mobilite";
  let score = theme.reduce((sc, t, i) => sc + (has(t) ? (i === 0 ? 10 : 4) : 0), 0);
  if (sameType) score += 5;
  else if (v.type && typeInfo(v.type).category === typeInfo(s.type).category) score += 2;
  else if (v.type && !cooldown) score -= 3; // autre famille (ex. HIIT cardio pour un WOD) : possible, mais après

  if (gear === "gym" && (has("barre") || has("haltères"))) score += 3;
  if (gear === "home") score += has("haltères") ? 3 : has("barre") ? -4 : 0; // BODYPUMP faisable aux haltères, mais moins adapté
  if (gear === "bodyweight" && has("sans matériel")) score += 3;
  if (ctx.level === "beginner" && (has("débutant") || has("faible impact"))) score += 2;
  if (ctx.level === "advanced" && has("débutant")) score -= 2;

  // Durée proche de la séance (≈ 15 min pour un retour au calme)
  const target = cooldown ? 15 : s.durationMin;
  score -= v.durationMin ? Math.min(8, Math.abs(v.durationMin - target) / 5) : 2;
  if (v.favorite) score += 3;
  if (v.id !== null && ctx.recentVideoIds.includes(v.id)) score -= 6;
  score += (hash(`${v.url}#${ctx.seed}`) % 300) / 100; // 0 à 3 : départage du jour
  return score > 0 ? { pick: { ...v, matched, cooldown } satisfies VideoPick, score } : null;
}

/** Vidéos du thème de la séance, de la plus adaptée à la moins adaptée. */
export function rankVideos(pool: CoachVideo[], s: CoachSession, ctx: CoachVideoContext, limit = 6): { theme: string[]; picks: VideoPick[] } {
  const theme = themeOf(s);
  const gear = gearOf(s, ctx.equipment);
  const picks = pool
    .map((v) => scoreVideo(v, s, theme, gear, ctx))
    .filter((x) => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.pick);
  return { theme, picks };
}

const CATALOG_IDS = new Set(VIDEO_CATALOG.map((c) => c.yt));
export const isCatalogUrl = (url: string) => CATALOG_IDS.has(youtubeId(url) ?? "");

export const catalogVideos = (): CoachVideo[] =>
  VIDEO_CATALOG.map((c) => ({
    id: null,
    url: catalogUrl(c),
    title: c.title,
    tags: c.tags,
    type: c.type,
    durationMin: c.durationMin,
    favorite: false,
    notes: CHANNELS[c.channel].name,
  }));

/**
 * Vidéo(s) du coach pour une séance. Tant que la sélection n'est pas importée dans la vidéothèque,
 * le coach pioche aussi dedans ; ensuite la vidéothèque fait foi (une vidéo supprimée n'est plus proposée).
 */
export function coachVideosFor(o: { library: CoachVideo[]; session: CoachSession; profile: Profile; workouts: Workout[]; day: string }): CoachVideoResult {
  const fromCatalog = !o.library.some((v) => isCatalogUrl(v.url));
  const pool = fromCatalog ? [...o.library, ...catalogVideos()] : o.library;
  const known = o.profile.planDays.length > 0; // questionnaire du coach rempli → matériel et niveau connus
  const since = addDays(o.day, -14);
  const ctx: CoachVideoContext = {
    equipment: known ? (o.profile.planEquipment as Equipment) : null,
    level: known ? (o.profile.planLevel as Level) : null,
    recentVideoIds: o.workouts.filter((w) => w.videoId && dayKey(w.date) >= since).map((w) => w.videoId!),
    seed: Number(o.day.replaceAll("-", "")) + hash(o.session.templateId ?? o.session.type),
  };
  const { theme, picks } = rankVideos(pool, o.session, ctx);
  return { theme, picks, fromCatalog: fromCatalog && picks.some((p) => p.id === null) };
}
