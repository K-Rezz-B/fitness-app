import type { Profile, Weight } from "./schema";
import { ACTIVITY_LEVELS } from "./constants";
import { ageFrom, addDays, today } from "./dates";
import type { Stats } from "./stats";

export type Advice = { level: "good" | "info" | "warning"; title: string; body: string; source?: string };

export const SOURCES = {
  mifflin: "Mifflin et al., Am J Clin Nutr 1990",
  who: "OMS, Lignes directrices activité physique 2020",
  issn: "ISSN Position Stand: Protein & Exercise, 2017",
  helms: "Helms et al., JISSN 2014",
  gabbett: "Gabbett, Br J Sports Med 2016 (ACWR)",
  efsa: "EFSA, Dietary Reference Values for water, 2010",
  bmi: "OMS, classification IMC",
};

export function movingAverage(ws: Weight[], days = 7) {
  const sorted = [...ws].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => {
    const from = addDays(w.date, -(days - 1));
    const win = sorted.filter((x) => x.date >= from && x.date <= w.date);
    return { date: w.date, weight: w.weightKg, avg: win.reduce((s, x) => s + x.weightKg, 0) / win.length };
  });
}

export function coach(p: Profile | undefined, ws: Weight[], stats: Stats) {
  const advice: Advice[] = [];
  const latest = [...ws].sort((a, b) => b.date.localeCompare(a.date))[0];
  const age = ageFrom(p?.birthDate);
  const h = p?.heightCm ?? null;
  const kg = latest?.weightKg ?? null;

  if (!p || !h || !kg || age === null) {
    return {
      ready: false as const,
      missing: [!h && "taille", age === null && "date de naissance", !kg && "un poids"].filter(Boolean) as string[],
      advice,
    };
  }

  const m = h / 100;
  const bmi = kg / (m * m);
  const bmiLabel =
    bmi < 18.5 ? "Insuffisance pondérale" : bmi < 25 ? "Corpulence normale" : bmi < 30 ? "Surpoids" : "Obésité";
  const healthyRange = [18.5 * m * m, 24.9 * m * m];

  const bmr = 10 * kg + 6.25 * h - 5 * age + (p.sex === "female" ? -161 : 5);
  const factor = ACTIVITY_LEVELS[p.activityLevel as keyof typeof ACTIVITY_LEVELS]?.factor ?? 1.55;
  const tdee = bmr * factor;
  const goalAdj = { lose: -0.2, maintain: 0, gain: 0.1, performance: 0.05 }[p.goal] ?? 0;
  const calories = Math.max(Math.round(bmr * 1.1), Math.round(tdee * (1 + goalAdj)));
  const proteinPerKg = { lose: 2.0, maintain: 1.6, gain: 1.8, performance: 1.8 }[p.goal] ?? 1.6;
  const protein = Math.round(kg * proteinPerKg);
  const fat = Math.max(Math.round(kg * 0.8), Math.round((calories * 0.28) / 9));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const trainHoursPerDay = stats.current.minutes / 60 / 7;
  const waterL = Math.round((kg * 0.035 + trainHoursPerDay * 0.5) * 10) / 10;

  // Tendance du poids : moyenne 7 j actuelle vs 7 j il y a 2 semaines
  const t = today();
  const avgBetween = (from: string, to: string) => {
    const win = ws.filter((w) => w.date >= from && w.date <= to);
    return win.length ? win.reduce((s, w) => s + w.weightKg, 0) / win.length : null;
  };
  const nowAvg = avgBetween(addDays(t, -6), t);
  const prevAvg = avgBetween(addDays(t, -20), addDays(t, -14));
  const weeklyRate = nowAvg && prevAvg ? (nowAvg - prevAvg) / 2 : null;
  const weeklyPct = weeklyRate !== null && prevAvg ? (weeklyRate / prevAvg) * 100 : null;

  // ---- Conseils nutrition / poids ----
  if (weeklyPct !== null) {
    if (p.goal === "lose") {
      if (weeklyPct < -1)
        advice.push({ level: "warning", title: "Perte trop rapide", body: `${weeklyPct.toFixed(1)} %/sem. Au-delà de 1 %/sem, tu risques de perdre du muscle : ajoute ~150 kcal/j.`, source: SOURCES.helms });
      else if (weeklyPct <= -0.4)
        advice.push({ level: "good", title: "Rythme de perte idéal", body: `${weeklyPct.toFixed(1)} %/sem, dans la zone 0,5-1 % qui préserve la masse maigre.`, source: SOURCES.helms });
      else
        advice.push({ level: "info", title: "Perte lente / plateau", body: "Moins de 0,4 %/sem sur 2 semaines : réduis de 100-200 kcal/j ou ajoute 2 000 pas/j.", source: SOURCES.helms });
    } else if (p.goal === "gain") {
      if (weeklyPct > 0.5)
        advice.push({ level: "warning", title: "Prise trop rapide", body: `+${weeklyPct.toFixed(1)} %/sem : au-delà de ~0,25-0,5 %/sem, l'excédent part surtout en gras.`, source: SOURCES.helms });
      else if (weeklyPct >= 0.1)
        advice.push({ level: "good", title: "Prise de masse maîtrisée", body: `+${weeklyPct.toFixed(2)} %/sem : parfait pour une prise propre.`, source: SOURCES.helms });
      else
        advice.push({ level: "info", title: "Pas de prise de poids", body: "Ajoute ~150-200 kcal/j (glucides autour de l'entraînement).", source: SOURCES.helms });
    }
  } else {
    advice.push({ level: "info", title: "Pèse-toi régulièrement", body: "3-4 pesées/sem au réveil permettent une tendance fiable sur 7 jours." });
  }

  // ---- Conseils entraînement ----
  if (stats.who7 >= 150)
    advice.push({ level: "good", title: "Objectif OMS atteint", body: `${stats.who7} min équivalent modéré sur 7 j (recommandation : 150-300).`, source: SOURCES.who });
  else
    advice.push({ level: "info", title: `Encore ${150 - stats.who7} min pour l'OMS`, body: "Vise 150-300 min modérées ou 75-150 min intenses par semaine.", source: SOURCES.who });

  const strength = stats.last7.filter((w) => ["muscu", "calisthenics", "crossfit"].includes(w.type)).length;
  if (strength < 2)
    advice.push({ level: "info", title: "Renforcement musculaire", body: `${strength} séance(s) de force sur 7 j. L'OMS en recommande au moins 2.`, source: SOURCES.who });

  if (stats.acwr !== null && stats.chronic > 0) {
    if (stats.acwr > 1.5)
      advice.push({ level: "warning", title: "Pic de charge", body: `Ratio aigu/chronique ${stats.acwr.toFixed(2)} (> 1,5) : risque de blessure accru. Allège les 3 prochains jours.`, source: SOURCES.gabbett });
    else if (stats.acwr >= 0.8)
      advice.push({ level: "good", title: "Charge bien dosée", body: `Ratio aigu/chronique ${stats.acwr.toFixed(2)} : zone optimale 0,8-1,3.`, source: SOURCES.gabbett });
    else
      advice.push({ level: "info", title: "Charge en baisse", body: `Ratio ${stats.acwr.toFixed(2)} (< 0,8) : tu peux augmenter progressivement (+10 %/sem).`, source: SOURCES.gabbett });
  }

  if (stats.daysSinceLast !== null && stats.daysSinceLast >= 4)
    advice.push({ level: "warning", title: `${stats.daysSinceLast} jours sans séance`, body: "Même 20 minutes aujourd'hui suffisent à garder l'élan. 💪" });

  if (p.goal === "gain" || p.goal === "lose")
    advice.push({ level: "info", title: "Protéines réparties", body: `Vise ~${Math.round(kg * 0.4)} g de protéines par repas, sur 3-4 repas.`, source: SOURCES.issn });

  advice.push({ level: "info", title: "Sommeil", body: "7-9 h par nuit : c'est là que se fait la récupération et la synthèse musculaire." });

  const target = p.targetWeightKg;
  let eta: number | null = null;
  if (target && Math.abs(target - kg) > 0.3) {
    const rate = kg * (p.goal === "gain" ? 0.0035 : 0.0075); // kg/sem prudents
    eta = Math.ceil(Math.abs(target - kg) / rate);
  }

  return {
    ready: true as const,
    age,
    kg,
    bmi,
    bmiLabel,
    healthyRange,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    fat,
    carbs,
    waterL,
    weeklyRate,
    weeklyPct,
    target,
    eta,
    advice,
  };
}
