import type { Metadata } from "next";
import Link from "next/link";
import { Apple, ArrowLeftRight, ChevronRight, Lock, ScanFace, Trash2 } from "lucide-react";
import { getPasskeys, getWeights } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { ACTIVITY_LEVELS, GOALS } from "@/lib/constants";
import { fmtDate, today } from "@/lib/dates";
import { addWeight, changePin, deleteProfile, deleteWeight, lockProfile, logout, saveProfile } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { EmojiPicker } from "@/components/emoji-picker";
import { ActionForm, NewPinFields, PinInput } from "@/components/action-form";
import { PasskeyRegisterButton } from "@/components/passkeys";
import { ConfirmButton, Form, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Profil" };

export default async function Profile({ searchParams }: PageProps<"/profile">) {
  const p = await requireProfile();
  const [ws, keys, sp] = await Promise.all([getWeights(p.id), getPasskeys(p.id), searchParams]);
  return (
    <>
      <PageHeader
        title="Profil"
        subtitle="Ces infos alimentent le coach et ton score"
        action={
          <Link href="/profiles" aria-label="Changer de profil" className="btn-ghost">
            <ArrowLeftRight size={16} /> <span className="hidden sm:inline">Changer de profil</span>
          </Link>
        }
      />

      {sp.welcome && (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          🎉 Profil créé et protégé par ton code ! Complète tes infos et ta première pesée pour activer le coach.
        </div>
      )}
      {sp.pin && (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          🔒 Code enregistré : ton profil est maintenant verrouillé. Active Face ID plus bas pour l&apos;ouvrir sans le taper.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 font-semibold">⚖️ Nouvelle pesée</div>
          <Form action={addWeight} success="Pesée enregistrée ⚖️" className="grid grid-cols-3 gap-2">
            <input name="weightKg" type="number" step="0.1" inputMode="decimal" placeholder="kg" required className="input" />
            <input name="bodyFatPct" type="number" step="0.1" inputMode="decimal" placeholder="% gras" className="input" />
            <input name="date" type="date" defaultValue={today()} required className="input" />
            <SubmitButton className="btn-primary col-span-3">Enregistrer</SubmitButton>
          </Form>
          <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto">
            {ws.map((w, i) => {
              const prev = ws[i + 1];
              const d = prev ? w.weightKg - prev.weightKg : 0;
              return (
                <li key={w.id} className="animate-fade-up flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 text-muted">{fmtDate(w.date)}</span>
                  <span className="font-mono font-semibold tabular-nums">{w.weightKg.toFixed(1)} kg</span>
                  {prev && <span className="font-mono text-xs text-ink-2 tabular-nums">{d > 0 ? "▲ +" : d < 0 ? "▼ " : "= "}{d !== 0 ? d.toFixed(1) : ""}</span>}
                  {w.bodyFatPct && <span className="chip py-0.5">{w.bodyFatPct} %</span>}
                  <Form action={deleteWeight} success="Pesée supprimée" className="ml-auto">
                    <input type="hidden" name="id" value={w.id} />
                    <ConfirmButton aria-label="Supprimer" confirmLabel="Supprimer ?" className="rounded-lg px-1.5 py-1 text-xs text-muted hover:text-critical" armedClassName="bg-critical text-white">
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </Form>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="mb-3 font-semibold">🧍 Mes infos</div>
          <Form action={saveProfile} success="Profil enregistré" className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Prénom</label>
              <input name="name" defaultValue={p.name} required maxLength={60} className="input" />
            </div>
            <div className="col-span-2">
              <EmojiPicker value={p.emoji} />
            </div>
            <div>
              <label className="label">Sexe</label>
              <select name="sex" defaultValue={p.sex} className="input">
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </div>
            <div>
              <label className="label">Naissance</label>
              <input name="birthDate" type="date" defaultValue={p.birthDate ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Taille (cm)</label>
              <input name="heightCm" type="number" inputMode="decimal" defaultValue={p.heightCm ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Poids cible (kg)</label>
              <input name="targetWeightKg" type="number" step="0.1" inputMode="decimal" defaultValue={p.targetWeightKg ?? ""} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Activité hors sport</label>
              <select name="activityLevel" defaultValue={p.activityLevel} className="input">
                {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Objectif</label>
              <select name="goal" defaultValue={p.goal} className="input">
                {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Séances / semaine</label>
              <input name="weeklySessionsTarget" type="number" min={1} max={14} defaultValue={p.weeklySessionsTarget} className="input" />
            </div>
            <div>
              <label className="label">Objectif Bouger (kcal/j)</label>
              <input name="moveGoalKcal" type="number" inputMode="numeric" min={50} max={3000} step={10} defaultValue={p.moveGoalKcal} className="input" />
            </div>
            <div>
              <label className="label">Objectif pas / jour</label>
              <input name="stepsGoal" type="number" inputMode="numeric" min={1000} max={30000} step={500} defaultValue={p.stepsGoal} className="input" />
            </div>
            <SubmitButton className="btn-primary col-span-2">Enregistrer</SubmitButton>
          </Form>
        </section>
      </div>

      <Link href="/integrations" className="card mt-4 flex items-center gap-3 p-4 transition hover:border-muted">
        <Apple size={20} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Apple Santé, Watch, notifications, Face ID & widget</span>
          <span className="block text-xs text-muted">Import automatique des séances, rappels, connexion sans mot de passe</span>
        </span>
        <ChevronRight size={16} className="text-muted" />
      </Link>

      <section className="card mt-4">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Lock size={18} className="text-accent" /> Verrouillage du profil
        </div>
        <p className="text-sm text-ink-2">
          Ton profil s&apos;ouvre avec ton code PIN{keys.length > 0 && " ou Face ID"}. Il reste ouvert sur cet appareil jusqu&apos;à ce que tu le
          verrouilles ou que quelqu&apos;un d&apos;autre ouvre son profil.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanFace size={16} className="text-force" /> Face ID / Touch ID
            </div>
            {keys.length > 0 ? (
              <p className="text-sm text-muted">
                Activé sur {keys.length} appareil{keys.length > 1 ? "s" : ""} ·{" "}
                <Link href="/integrations" className="underline">gérer</Link>
              </p>
            ) : (
              <p className="text-sm text-muted">Pas encore activé : déverrouille ton profil d&apos;un regard.</p>
            )}
            <PasskeyRegisterButton />
          </div>
          <details className="rounded-2xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-semibold">Changer de code PIN</summary>
            <ActionForm action={changePin} submit="Changer le code" pendingLabel="Vérification…" className="mt-3">
              <PinInput name="currentPin" label="Code actuel" />
              <NewPinFields label="Nouveau code" />
            </ActionForm>
          </details>
        </div>
        <form action={lockProfile} className="mt-4">
          <SubmitButton className="btn-ghost w-full sm:w-auto">
            <Lock size={16} /> Verrouiller maintenant
          </SubmitButton>
        </form>
      </section>

      <details className="card mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-critical">Supprimer le profil « {p.name} »</summary>
        <ActionForm
          action={deleteProfile}
          danger
          submit={<><Trash2 size={16} /> Supprimer définitivement</>}
          pendingLabel="Suppression…"
          className="mt-3 space-y-3"
        >
          <p className="text-sm text-ink-2">
            Supprime définitivement ce profil et toutes ses données : séances, pesées, planning et vidéos. Les autres profils ne sont pas touchés.
          </p>
          <div className="max-w-48">
            <PinInput label="Ton code PIN" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" required className="h-4 w-4 accent-[var(--color-critical)]" />
            Je confirme, c&apos;est irréversible
          </label>
        </ActionForm>
      </details>

      <form action={logout} className="mt-6 text-center">
        <button className="text-sm text-muted underline">Se déconnecter</button>
      </form>
    </>
  );
}
