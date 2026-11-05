import type { Metadata } from "next";
import { headers } from "next/headers";
import { BellRing, CalendarPlus, Download, Pencil, Trash2 } from "lucide-react";
import { getPlans, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { calendarToken } from "@/lib/auth";
import { WEEKDAYS, WORKOUT_TYPES, typeInfo, CATEGORIES } from "@/lib/constants";
import { addDays, dayKey, today, weekStart } from "@/lib/dates";
import { deletePlan, savePlan, togglePlan } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Empty, PageHeader } from "@/components/ui";
import type { Plan } from "@/lib/schema";
import { CoachSection } from "./coach-section";

export const metadata: Metadata = { title: "Planning" };

function PlanFields({ p }: { p?: Plan }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="col-span-2 sm:col-span-3">
        <label className="label">Titre</label>
        <input name="title" defaultValue={p?.title} placeholder="Ex : Push day" className="input" />
      </div>
      <div>
        <label className="label">Type</label>
        <select name="type" defaultValue={p?.type ?? "muscu"} className="input">
          {WORKOUT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Jour</label>
        <select name="weekday" defaultValue={p?.weekday ?? 1} className="input">
          {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Heure</label>
        <input name="time" type="time" defaultValue={p?.time ?? "18:30"} required className="input" />
      </div>
      <div>
        <label className="label">Durée (min)</label>
        <input name="durationMin" type="number" inputMode="numeric" defaultValue={p?.durationMin ?? 60} className="input" />
      </div>
      <div>
        <label className="label">Rappel avant</label>
        <select name="reminderMin" defaultValue={p?.reminderMin ?? 30} className="input">
          {[0, 10, 15, 30, 60, 120, 1440].map((m) => (
            <option key={m} value={m}>{m === 0 ? "À l'heure seulement" : m === 1440 ? "La veille" : m >= 60 ? `${m / 60} h` : `${m} min`}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default async function Planning() {
  const me = await requireProfile();
  const [plans, workouts, h, token] = await Promise.all([getPlans(me.id), getWorkouts(me.id), headers(), calendarToken(me.id)]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const feed = token ? `webcal://${host}/api/calendar/${token}.ics` : null;

  const t = today();
  const ws = weekStart(t);
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekWorkouts = workouts.filter((w) => dayKey(w.date) >= ws);
  const active = plans.filter((p) => p.active);
  const done = active.filter((p) => {
    const key = weekKeys[p.weekday - 1];
    return weekWorkouts.some((w) => dayKey(w.date) === key && typeInfo(w.type).category === typeInfo(p.type).category);
  }).length;

  return (
    <>
      <PageHeader title="Planning" subtitle={`${active.length} séance(s) obligatoire(s) / semaine`} />

      {/* Semaine en cours */}
      <section className="card mb-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Cette semaine</span>
          <span className="font-mono text-sm tabular-nums">{done}/{active.length} ✔︎</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekKeys.map((k, i) => {
            const dayPlans = active.filter((p) => p.weekday === i + 1);
            const dayDone = weekWorkouts.filter((w) => dayKey(w.date) === k);
            const isToday = k === t;
            return (
              <div key={k} className={`flex min-h-24 flex-col items-center gap-1 rounded-2xl border p-1.5 ${isToday ? "border-accent" : "border-line"} bg-surface-2`}>
                <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-accent" : "text-muted"}`}>{WEEKDAYS[i].slice(0, 3)}</span>
                <span className="font-mono text-xs">{Number(k.slice(8))}</span>
                {dayPlans.map((p) => {
                  const ok = dayDone.some((w) => typeInfo(w.type).category === typeInfo(p.type).category);
                  const late = !ok && k < t;
                  return (
                    <span key={p.id} title={`${p.time} ${p.title}`} className={`text-lg ${late ? "opacity-40 grayscale" : ""}`}>
                      {ok ? "✅" : typeInfo(p.type).emoji}
                    </span>
                  );
                })}
                {dayDone.filter((w) => !dayPlans.some((p) => typeInfo(p.type).category === typeInfo(w.type).category)).map((w) => (
                  <span key={w.id} title={w.title} className="text-xs">⭐</span>
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">✅ fait · ⭐ séance bonus · grisé = manquée</p>
      </section>

      <CoachSection me={me} coachPlans={plans.filter((p) => p.source === "coach")} workouts={workouts} />

      {/* Calendrier Apple */}
      <section className="glow mb-4 rounded-3xl border border-line p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <BellRing size={18} className="text-accent" /> Rappels dans Calendrier Apple
        </div>
        {feed ? (
          <>
            <p className="mb-3 text-sm text-ink-2">
              Abonne-toi une fois (lien propre au profil <b>{me.name}</b>) : tes séances apparaissent sur iPhone, Mac et Apple Watch avec 2 alertes (avant + à l&apos;heure). Toute modif ici se met à jour toute seule.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={feed} className="btn-primary"><CalendarPlus size={16} /> S&apos;abonner</a>
              <CopyButton text={feed.replace("webcal://", "https://")} />
              <a href="/api/plans/ics" className="btn-ghost"><Download size={16} /> Importer (.ics)</a>
            </div>
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer">Réglages recommandés</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li><b>Mac</b> : Calendrier › Fichier › Nouvel abonnement › colle l&apos;URL › Emplacement <b>iCloud</b> (synchro iPhone) › <b>décoche « Supprimer : Alertes »</b> › Actualisation : toutes les heures.</li>
                <li><b>iPhone</b> : Réglages › Calendrier › Comptes › Ajouter › Autre › Calendrier avec abonnement.</li>
                <li>« Importer » crée des événements fixes (alertes garanties) mais sans mise à jour auto.</li>
              </ul>
            </details>
          </>
        ) : (
          <p className="text-sm text-warning">Définis la variable <code>CALENDAR_TOKEN</code> dans Vercel pour activer le flux.</p>
        )}
      </section>

      {/* Liste */}
      <section className="mb-4 space-y-2">
        {plans.length === 0 && <Empty emoji="🗓️" title="Aucune séance planifiée">Ajoute tes créneaux fixes ci-dessous.</Empty>}
        {plans.map((p) => {
          const info = typeInfo(p.type);
          return (
            <details key={p.id} className={`card group p-0 ${p.active ? "" : "opacity-50"}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-xl" style={{ boxShadow: `inset 0 -3px 0 ${CATEGORIES[info.category].color}` }}>{info.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.title}</span>
                    {p.source === "coach" && <span className="chip shrink-0 py-0.5 text-[10px]">🧠 Coach</span>}
                  </div>
                  <div className="text-xs text-muted">{WEEKDAYS[p.weekday - 1]} · {p.time} · {p.durationMin} min · 🔔 {p.reminderMin ? `${p.reminderMin >= 60 ? `${p.reminderMin / 60} h` : `${p.reminderMin} min`} avant` : "à l'heure"}</div>
                </div>
                <Pencil size={16} className="text-muted" />
              </summary>
              <div className="border-t border-line p-4">
                <form action={savePlan} className="space-y-3">
                  <PlanFields p={p} />
                  <button className="btn-primary w-full">Enregistrer</button>
                </form>
                <div className="mt-2 flex gap-2">
                  <form action={togglePlan} className="flex-1">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-ghost w-full">{p.active ? "Mettre en pause" : "Réactiver"}</button>
                  </form>
                  <a href={`/api/plans/ics?id=${p.id}`} className="btn-ghost" aria-label="Importer"><Download size={16} /></a>
                  <form action={deletePlan}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-ghost text-critical" aria-label="Supprimer"><Trash2 size={16} /></button>
                  </form>
                </div>
              </div>
            </details>
          );
        })}
      </section>

      <section className="card">
        <div className="mb-3 font-semibold">➕ Ajouter un créneau</div>
        <form action={savePlan} className="space-y-3">
          <PlanFields />
          <button className="btn-primary w-full">Ajouter au planning</button>
        </form>
      </section>
    </>
  );
}
