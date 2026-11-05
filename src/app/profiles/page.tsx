import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { listProfiles } from "@/lib/data";
import { getActiveProfile, requireAuth } from "@/lib/session";
import { createProfile, logout, selectProfile } from "@/app/actions";
import { EmojiPicker } from "@/components/emoji-picker";

export const metadata: Metadata = { title: "Profils" };

/** Sélecteur de profils : affiché après connexion dès qu'il y a plusieurs profils (ou aucun). */
export default async function Profiles() {
  await requireAuth();
  const [all, me] = await Promise.all([listProfiles(), getActiveProfile()]);
  const empty = all.length === 0;
  return (
    <main className="glow pt-safe grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-2xl text-black">⚡</div>
          <h1 className="text-3xl font-bold tracking-tight">{empty ? "Crée ton profil" : "Qui s'entraîne ?"}</h1>
          <p className="mt-2 text-sm text-muted">Chaque profil a ses propres séances, pesées, planning et vidéos.</p>
        </div>

        {!empty && (
          <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {all.map((p) => (
              <li key={p.id}>
                <form action={selectProfile}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    className={clsx(
                      "card flex w-full flex-col items-center gap-2 p-4 transition hover:border-accent active:scale-[.98]",
                      me?.id === p.id && "border-accent",
                    )}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-3xl">{p.emoji}</span>
                    <span className="max-w-full truncate font-semibold">{p.name || "Sans nom"}</span>
                    {me?.id === p.id && <span className="text-[10px] font-semibold tracking-wide text-accent uppercase">Actif</span>}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details open={empty} className="card">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <Plus size={18} className="text-accent" /> Ajouter un profil
          </summary>
          <form action={createProfile} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="name">Prénom</label>
              <input id="name" name="name" required maxLength={60} autoComplete="given-name" className="input" />
            </div>
            <EmojiPicker />
            <button className="btn-primary w-full">Créer le profil</button>
          </form>
        </details>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          {me && <Link href="/" className="text-muted underline">Retour à l&apos;app</Link>}
          <form action={logout}>
            <button className="text-muted underline">Se déconnecter</button>
          </form>
        </div>
      </div>
    </main>
  );
}
