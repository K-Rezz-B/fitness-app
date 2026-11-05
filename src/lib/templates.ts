import type { Exercise } from "./schema";
import { typeInfo, type Category } from "./constants";
import type { Workout } from "./schema";
import { addDays, dayKey, today, weekStart } from "./dates";

export type Template = {
  id: string;
  type: string;
  title: string;
  durationMin: number;
  rpe: number;
  focus: string;
  exercises: { name: string; sets: number; reps: string }[];
};

const T = (
  id: string,
  type: string,
  title: string,
  durationMin: number,
  rpe: number,
  focus: string,
  exercises: [string, number, string][],
): Template => ({
  id,
  type,
  title,
  durationMin,
  rpe,
  focus,
  exercises: exercises.map(([name, sets, reps]) => ({ name, sets, reps })),
});

export const TEMPLATES: Template[] = [
  T("fullbody-a", "muscu", "Full body A", 60, 7, "Polyarticulaires lourds", [
    ["Squat", 4, "6-8"], ["Développé couché", 4, "6-8"], ["Rowing barre", 3, "8-10"],
    ["Fentes marchées", 3, "10/jambe"], ["Gainage planche", 3, "45 s"],
  ]),
  T("push", "muscu", "Push (pecs/épaules/triceps)", 55, 7, "Poussée", [
    ["Développé incliné haltères", 4, "8-10"], ["Développé militaire", 3, "6-8"],
    ["Dips", 3, "max"], ["Élévations latérales", 3, "12-15"], ["Extension triceps poulie", 3, "12"],
  ]),
  T("pull", "muscu", "Pull (dos/biceps)", 55, 7, "Tirage", [
    ["Tractions", 4, "max"], ["Rowing haltère", 3, "10/bras"], ["Tirage vertical", 3, "10-12"],
    ["Face pull", 3, "15"], ["Curl incliné", 3, "10-12"],
  ]),
  T("legs", "muscu", "Jambes & fessiers", 60, 8, "Bas du corps", [
    ["Squat", 4, "6-8"], ["Soulevé de terre roumain", 3, "8-10"], ["Presse à cuisses", 3, "12"],
    ["Hip thrust", 3, "10"], ["Mollets debout", 4, "15"],
  ]),
  T("bw-circuit", "calisthenics", "Circuit poids du corps", 35, 7, "Endurance musculaire, sans matériel", [
    ["Pompes", 4, "15"], ["Squats sautés", 4, "15"], ["Pompes diamant", 3, "10"],
    ["Fentes alternées", 4, "20"], ["Superman", 3, "15"], ["Mountain climbers", 4, "30 s"],
  ]),
  T("wod", "crossfit", "WOD AMRAP 20'", 30, 9, "Conditionnement global", [
    ["AMRAP 20 min : 5 tractions", 1, "5"], ["10 pompes", 1, "10"], ["15 air squats", 1, "15"],
  ]),
  T("tabata", "hiit", "Tabata 4 blocs", 25, 9, "Puissance anaérobie (20 s / 10 s)", [
    ["Burpees", 8, "20 s"], ["Jumping jacks", 8, "20 s"], ["Squats sautés", 8, "20 s"], ["Mountain climbers", 8, "20 s"],
  ]),
  T("emom", "hiit", "EMOM 16'", 20, 8, "Cardio-force", [
    ["Min impaire : 12 kettlebell swings", 8, "12"], ["Min paire : 10 burpees", 8, "10"],
  ]),
  T("ef", "course", "Endurance fondamentale", 45, 4, "Zone 2 – aisance respiratoire", [["Footing conversationnel", 1, "45 min"]]),
  T("fractionne", "course", "Fractionné 10×400 m", 45, 8, "VMA", [
    ["Échauffement", 1, "15 min"], ["400 m rapide / 1'30 récup", 10, "400 m"], ["Retour au calme", 1, "10 min"],
  ]),
  T("sortie-longue", "course", "Sortie longue", 75, 5, "Endurance", [["Course continue", 1, "75 min"]]),
  T("velo-z2", "velo", "Vélo zone 2", 60, 4, "Base aérobie", [["Pédalage régulier", 1, "60 min"]]),
  T("velo-sst", "velo", "Sweet spot 3×10'", 50, 7, "Seuil", [["Échauffement", 1, "10 min"], ["Effort 88-93 % FTP", 3, "10 min"], ["Récup", 1, "10 min"]]),
  T("nage", "natation", "Natation technique", 40, 5, "Technique & endurance", [
    ["Échauffement crawl", 1, "200 m"], ["Éducatifs", 4, "50 m"], ["Crawl", 8, "100 m"], ["Retour au calme", 1, "100 m"],
  ]),
  T("rando", "marche", "Marche active", 60, 3, "Récupération active", [["Marche rapide", 1, "60 min"]]),
  T("boxe", "boxe", "Boxe shadow & sac", 40, 8, "Cardio & coordination", [
    ["Shadow boxing", 3, "3 min"], ["Sac de frappe", 6, "3 min"], ["Gainage", 3, "45 s"],
  ]),
  T("corde", "corde", "Corde à sauter en intervalles", 25, 8, "Cardio, coordination & mollets", [
    ["Échauffement sauts lents", 1, "3 min"], ["Sauts rapides / 30 s récup", 10, "1 min"],
    ["Montées de genoux ou double unders", 5, "30 s"], ["Étirements mollets & chevilles", 1, "3 min"],
  ]),
  T("yoga-flow", "yoga", "Yoga vinyasa", 40, 3, "Souplesse & respiration", [
    ["Salutations au soleil", 5, "1 cycle"], ["Guerrier I/II", 2, "5 resp."], ["Pigeon", 2, "1 min/côté"], ["Savasana", 1, "5 min"],
  ]),
  T("mobility", "mobilite", "Mobilité complète", 25, 2, "Récupération, amplitude", [
    ["Cat-cow", 2, "10"], ["World's greatest stretch", 2, "5/côté"], ["90/90 hanches", 2, "1 min"],
    ["Ouverture thoracique", 2, "10"], ["Étirement ischios", 2, "45 s"],
  ]),

  // --- Salle : variantes pour les programmes du coach (full body B, haut / bas du corps) ---
  T("fullbody-b", "muscu", "Full body B", 60, 7, "Polyarticulaires, variante", [
    ["Soulevé de terre", 3, "5"], ["Développé militaire", 3, "6-8"], ["Tirage vertical", 3, "8-10"],
    ["Presse à cuisses", 3, "10-12"], ["Gainage latéral", 3, "30 s/côté"],
  ]),
  T("upper", "muscu", "Haut du corps A", 55, 7, "Poussée + tirage, charges lourdes", [
    ["Développé couché", 4, "6-8"], ["Rowing barre", 4, "6-8"], ["Développé militaire", 3, "8-10"],
    ["Tirage vertical", 3, "10-12"], ["Curl haltères", 2, "12"], ["Extension triceps poulie", 2, "12"],
  ]),
  T("upper-b", "muscu", "Haut du corps B", 55, 7, "Volume haut du corps", [
    ["Développé incliné haltères", 4, "8-10"], ["Tractions", 4, "max"], ["Élévations latérales", 3, "12-15"],
    ["Rowing haltère", 3, "10/bras"], ["Face pull", 3, "15"],
  ]),
  T("lower-b", "muscu", "Bas du corps B", 55, 7, "Chaîne postérieure", [
    ["Soulevé de terre roumain", 4, "8"], ["Fentes bulgares", 3, "10/jambe"], ["Leg curl", 3, "12"],
    ["Hip thrust", 3, "10"], ["Gainage planche", 3, "45 s"],
  ]),

  // --- Maison avec haltères ---
  T("db-fullbody-a", "muscu", "Full body haltères A", 45, 7, "Maison, haltères", [
    ["Goblet squat", 4, "10-12"], ["Développé couché haltères (sol)", 4, "10"], ["Rowing haltère", 3, "10/bras"],
    ["Fentes arrière haltères", 3, "10/jambe"], ["Gainage planche", 3, "45 s"],
  ]),
  T("db-fullbody-b", "muscu", "Full body haltères B", 45, 7, "Maison, haltères", [
    ["Soulevé de terre roumain haltères", 4, "10"], ["Développé militaire haltères", 3, "10"], ["Pompes", 3, "max"],
    ["Squat bulgare haltères", 3, "10/jambe"], ["Rowing penché haltères", 3, "12"],
  ]),
  T("db-upper", "muscu", "Haut du corps haltères", 45, 7, "Maison, haltères", [
    ["Développé couché haltères (sol)", 4, "8-10"], ["Rowing haltère", 4, "10/bras"], ["Développé militaire haltères", 3, "10"],
    ["Élévations latérales", 3, "12-15"], ["Curl haltères", 3, "12"],
  ]),
  T("db-lower", "muscu", "Bas du corps haltères", 45, 7, "Maison, haltères", [
    ["Goblet squat", 4, "10-12"], ["Soulevé de terre roumain haltères", 4, "10"], ["Squat bulgare haltères", 3, "10/jambe"],
    ["Hip thrust haltère", 3, "12"], ["Mollets debout", 3, "15"],
  ]),

  // --- Sans matériel ---
  T("bw-fullbody", "calisthenics", "Full body sans matériel", 35, 7, "Force au poids du corps", [
    ["Burpees", 3, "10"], ["Pompes", 4, "max"], ["Squat bulgare (chaise)", 3, "10/jambe"],
    ["Rowing sous une table", 3, "10"], ["Gainage planche", 3, "45 s"],
  ]),
  T("bw-upper", "calisthenics", "Haut du corps sans matériel", 35, 7, "Poussée + tirage au poids du corps", [
    ["Pompes", 4, "max"], ["Pompes déclinées", 3, "10"], ["Rowing sous une table", 4, "10-12"],
    ["Dips sur chaise", 3, "12"], ["Pike push-ups", 3, "8"], ["Superman", 3, "15"],
  ]),
  T("bw-lower", "calisthenics", "Bas du corps sans matériel", 35, 7, "Jambes & fessiers au poids du corps", [
    ["Squats", 4, "20"], ["Fentes sautées", 3, "10/jambe"], ["Squat bulgare (chaise)", 3, "12/jambe"],
    ["Pont fessier une jambe", 3, "12/jambe"], ["Chaise murale", 3, "45 s"], ["Mollets une jambe", 3, "15"],
  ]),
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

export function templateToExercises(t: Template): Exercise[] {
  return t.exercises.map((e) => ({
    name: `${e.name} (${e.sets}×${e.reps})`,
    sets: Array.from({ length: Math.min(e.sets, 10) }, () => {
      const n = parseInt(e.reps, 10);
      return Number.isFinite(n) && !/s|min|m$/.test(e.reps) ? { reps: n } : {};
    }),
  }));
}

/**
 * Choisit la prochaine catégorie pour varier l'entraînement.
 * `available` : programmes faisables par le profil (matériel, sports, niveau).
 */
export function suggest(recent: Workout[], weeklyTarget: number, available: Template[] = TEMPLATES): { template: Template; reason: string } {
  const t = today();
  const ws = weekStart(t);
  const thisWeek = recent.filter((w) => dayKey(w.date) >= ws);
  const last = recent.slice(0, 3).map((w) => typeInfo(w.type).category);
  const forceThisWeek = thisWeek.filter((w) => typeInfo(w.type).category === "force").length;
  const cardioThisWeek = thisWeek.filter((w) => typeInfo(w.type).category === "cardio").length;
  const hardYesterday = recent.some(
    (w) => dayKey(w.date) >= addDays(t, -1) && w.rpe >= 8,
  );
  const last7Load = recent
    .filter((w) => dayKey(w.date) >= addDays(t, -6))
    .reduce((s, w) => s + w.durationMin * w.rpe, 0);

  let cat: Category;
  let reason: string;
  if (hardYesterday || (last.length >= 3 && last.every((c) => c !== "mobilite") && last7Load > 1800)) {
    cat = "mobilite";
    reason = "Grosse charge récente : place à la récupération active.";
  } else if (forceThisWeek < 2) {
    cat = "force";
    reason = `L'OMS recommande ≥ 2 séances de renforcement/sem (${forceThisWeek} cette semaine).`;
  } else if (cardioThisWeek < Math.max(1, weeklyTarget - 2)) {
    cat = "cardio";
    reason = "Il manque du cardio cette semaine pour ton cœur et ton VO₂max.";
  } else if (last[0] && last[0] === last[1]) {
    const opts: Category[] = ["force", "cardio", "mobilite"];
    cat = opts.find((c) => c !== last[0])!;
    reason = "Deux séances identiques d'affilée : on change de stimulus.";
  } else {
    cat = "cardio";
    reason = "Semaine solide ! Un peu de cardio varié pour consolider.";
  }

  // évite le type pratiqué en dernier si possible, rotation déterministe par jour
  const inCat = (list: Template[]) => list.filter((tp) => typeInfo(tp.type).category === cat);
  const pool = inCat(available).length ? inCat(available) : inCat(TEMPLATES);
  const notLast = pool.filter((tp) => tp.type !== recent[0]?.type);
  const candidates = notLast.length ? notLast : pool;
  const seed = Number(t.replaceAll("-", ""));
  return { template: candidates[seed % candidates.length], reason };
}
