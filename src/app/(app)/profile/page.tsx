import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { getProfile, getWeights } from "@/lib/data";
import { ACTIVITY_LEVELS, GOALS } from "@/lib/constants";
import { fmtDate, today } from "@/lib/dates";
import { addWeight, deleteWeight, logout, saveProfile } from "@/app/actions";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Profil" };

export default async function Profile() {
  const [p, ws] = await Promise.all([getProfile(), getWeights()]);
  return (
    <>
      <PageHeader title="Profil" subtitle="Ces infos alimentent le coach et ton score" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 font-semibold">⚖️ Nouvelle pesée</div>
          <form action={addWeight} className="grid grid-cols-3 gap-2">
            <input name="weightKg" type="number" step="0.1" inputMode="decimal" placeholder="kg" required className="input" />
            <input name="bodyFatPct" type="number" step="0.1" inputMode="decimal" placeholder="% gras" className="input" />
            <input name="date" type="date" defaultValue={today()} required className="input" />
            <button className="btn-primary col-span-3">Enregistrer</button>
          </form>
          <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto">
            {ws.map((w, i) => {
              const prev = ws[i + 1];
              const d = prev ? w.weightKg - prev.weightKg : 0;
              return (
                <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 text-muted">{fmtDate(w.date)}</span>
                  <span className="font-mono font-semibold tabular-nums">{w.weightKg.toFixed(1)} kg</span>
                  {prev && <span className="font-mono text-xs text-ink-2 tabular-nums">{d > 0 ? "▲ +" : d < 0 ? "▼ " : "= "}{d !== 0 ? d.toFixed(1) : ""}</span>}
                  {w.bodyFatPct && <span className="chip py-0.5">{w.bodyFatPct} %</span>}
                  <form action={deleteWeight} className="ml-auto">
                    <input type="hidden" name="id" value={w.id} />
                    <button aria-label="Supprimer" className="text-muted hover:text-critical"><Trash2 size={14} /></button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="mb-3 font-semibold">🧍 Mes infos</div>
          <form action={saveProfile} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Prénom</label>
              <input name="name" defaultValue={p?.name} className="input" />
            </div>
            <div>
              <label className="label">Sexe</label>
              <select name="sex" defaultValue={p?.sex ?? "male"} className="input">
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </div>
            <div>
              <label className="label">Naissance</label>
              <input name="birthDate" type="date" defaultValue={p?.birthDate ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Taille (cm)</label>
              <input name="heightCm" type="number" inputMode="decimal" defaultValue={p?.heightCm ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Poids cible (kg)</label>
              <input name="targetWeightKg" type="number" step="0.1" inputMode="decimal" defaultValue={p?.targetWeightKg ?? ""} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Activité hors sport</label>
              <select name="activityLevel" defaultValue={p?.activityLevel ?? "moderate"} className="input">
                {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Objectif</label>
              <select name="goal" defaultValue={p?.goal ?? "maintain"} className="input">
                {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Séances / semaine</label>
              <input name="weeklySessionsTarget" type="number" min={1} max={14} defaultValue={p?.weeklySessionsTarget ?? 3} className="input" />
            </div>
            <button className="btn-primary col-span-2">Enregistrer</button>
          </form>
        </section>
      </div>

      <form action={logout} className="mt-6 text-center">
        <button className="text-sm text-muted underline">Se déconnecter</button>
      </form>
    </>
  );
}
