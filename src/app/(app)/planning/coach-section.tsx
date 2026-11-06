import Link from "next/link";
import { Brain, ChevronRight, RefreshCw } from "lucide-react";
import type { Plan, Profile, Workout } from "@/lib/schema";
import { GOALS, WEEKDAYS, typeInfo } from "@/lib/constants";
import { EQUIPMENT, LEVELS, PLANNER_SPORTS } from "@/lib/planner";
import { hasPlannerPrefs, phaseLabel, prescriptionFor } from "@/lib/coach-plan";
import { fmtDate } from "@/lib/dates";
import { regeneratePlan, removeCoachPlan, savePlannerPrefs } from "@/app/coach-actions";
import { ConfirmButton, Form, SubmitButton } from "@/components/forms";

const Chip = ({ name, value, checked, children }: { name: string; value: string | number; checked: boolean; children: React.ReactNode }) => (
  <label className="cursor-pointer">
    <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
    <span className="chip px-3 py-1.5 text-sm transition peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
      {children}
    </span>
  </label>
);

function PlannerForm({ p, submit }: { p: Profile; submit: string }) {
  const sports = new Set(p.planSports);
  const days = new Set(p.planDays);
  return (
    <Form action={savePlannerPrefs} success="Programme du coach à jour 🧠" className="space-y-4">
      <p className="text-sm text-ink-2">
        Objectif <b>{GOALS[p.goal as keyof typeof GOALS] ?? p.goal}</b> · <b>{p.weeklySessionsTarget}</b> séances / semaine{" "}
        <Link href="/profile" className="text-accent">(modifiable dans Profil)</Link>
      </p>
      <fieldset>
        <legend className="label">Jours où tu peux t&apos;entraîner</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => (
            <Chip key={d} name="days" value={i + 1} checked={days.has(i + 1)}>{d.slice(0, 3)}</Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="plan-time">Heure</label>
          <input id="plan-time" name="time" type="time" defaultValue={p.planTime} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="plan-min">Durée / séance</label>
          <select id="plan-min" name="sessionMin" defaultValue={p.planSessionMin} className="input">
            {[30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="plan-eq">Matériel</label>
          <select id="plan-eq" name="equipment" defaultValue={p.planEquipment} className="input">
            {Object.entries(EQUIPMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="plan-level">Niveau</label>
          <select id="plan-level" name="level" defaultValue={p.planLevel} className="input">
            {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">Cardio que tu aimes (facultatif)</legend>
        <div className="flex flex-wrap gap-2">
          {PLANNER_SPORTS.map((s) => (
            <Chip key={s} name="sports" value={s} checked={sports.has(s)}>{typeInfo(s).emoji} {typeInfo(s).label}</Chip>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="auto" defaultChecked={p.planAuto} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
        <span>Adapter automatiquement chaque dimanche soir (progression, semaine de décharge, séances ratées, charge trop élevée)</span>
      </label>
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingLabel="Le coach réfléchit…"><Brain size={16} /> {submit}</SubmitButton>
    </Form>
  );
}

export function CoachSection({ me, coachPlans, workouts }: { me: Profile; coachPlans: Plan[]; workouts: Workout[] }) {
  const active = hasPlannerPrefs(me) && (coachPlans.length > 0 || me.planNotes.length > 0);
  const ws = coachPlans[0]?.weekStart ?? null;

  if (!active)
    return (
      <section id="coach" className="glow mb-4 scroll-mt-6 rounded-3xl border border-line p-5">
        <div className="mb-1 flex items-center gap-2 font-semibold"><Brain size={18} className="text-accent" /> Laisse le coach planifier tes séances</div>
        <p className="mb-4 text-sm text-ink-2">
          Réponds une fois : le coach construit ta semaine (force, cardio, récupération) selon ton objectif, place les séances avec assez de repos, te donne les exercices et les charges, puis ajuste chaque semaine.
        </p>
        <PlannerForm p={me} submit="Générer mon programme" />
      </section>
    );

  return (
    <section id="coach" className="glow mb-4 scroll-mt-6 rounded-3xl border border-line p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold"><Brain size={18} className="text-accent" /> Programme du coach</span>
        <span className="chip">{phaseLabel(me, ws)}{ws ? ` · sem. du ${fmtDate(ws)}` : ""}</span>
      </div>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-xs text-ink-2">
        {me.planNotes.map((n) => <li key={n}>{n}</li>)}
      </ul>

      <ul className="space-y-2">
        {coachPlans.map((pl) => {
          const rx = prescriptionFor(me, pl, workouts);
          return (
            <li key={pl.id}>
              <details className="group rounded-2xl bg-surface-2">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 text-xs font-semibold text-muted uppercase">{WEEKDAYS[pl.weekday - 1].slice(0, 3)}<br />{pl.time}</span>
                  <span className="text-xl">{typeInfo(pl.type).emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{pl.title}</span>
                    <span className="block truncate text-xs text-muted">{pl.durationMin} min · RPE {pl.rpe ?? "—"} · {pl.notes}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted transition group-open:rotate-90" />
                </summary>
                <div className="border-t border-line px-4 py-3">
                  {rx && (
                    <ul className="mb-3 space-y-1 text-sm">
                      {rx.map((e) => (
                        <li key={e.name} className="flex flex-wrap justify-between gap-x-3">
                          <span>{e.name}</span>
                          <span className="font-mono text-xs text-ink-2">
                            {e.sets > 1 ? `${e.sets} × ` : ""}{e.reps}
                            {e.weightKg ? ` @ ${String(e.weightKg).replace(".", ",")} kg` : ""}
                            {e.hint ? ` · ${e.hint}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`/workouts/new?plan=${pl.id}`} className="btn-primary px-3 py-1.5 text-xs">Faire cette séance</Link>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Form action={regeneratePlan} success="Programme régénéré 🧠">
          <SubmitButton className="btn-ghost text-sm" pendingLabel="Régénération…"><RefreshCw size={14} /> Régénérer</SubmitButton>
        </Form>
        <Form action={removeCoachPlan} success="Programme retiré">
          <ConfirmButton className="btn-ghost text-sm text-critical" confirmLabel="Retirer le programme ?">Retirer le programme</ConfirmButton>
        </Form>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted">Modifier mes disponibilités et préférences</summary>
        <div className="mt-3">
          <PlannerForm p={me} submit="Enregistrer et régénérer" />
        </div>
      </details>
      <p className="mt-3 text-[11px] text-muted">
        Régénérer remplace uniquement les séances du coach (tes créneaux perso restent). Charges conseillées d&apos;après ta meilleure charge des 6 dernières semaines. Règles : OMS 2020, 48 h de récupération par groupe musculaire, cycle 3 semaines de progression + 1 de décharge, ratio de charge aiguë/chronique (Gabbett 2016).
      </p>
    </section>
  );
}
