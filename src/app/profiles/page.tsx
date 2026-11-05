import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import clsx from "clsx";
import { listProfiles } from "@/lib/data";
import { getActiveProfile, requireAuth } from "@/lib/session";
import { createProfile, lockProfile, logout } from "@/app/actions";
import { EmojiPicker } from "@/components/emoji-picker";
import { ActionForm, NewPinFields } from "@/components/action-form";

export const metadata: Metadata = { title: "Profils" };

/** Sélecteur de profils : chaque profil s'ouvre avec son code PIN ou Face ID (sauf celui déjà ouvert sur cet appareil). */
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
          <p className="mt-2 text-sm text-muted">Chaque profil a ses propres données et s&apos;ouvre avec son code PIN ou Face ID.</p>
        </div>

        {!empty && (
          <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {all.map((p) => {
              const open = me?.id === p.id;
              return (
                <li key={p.id}>
                  <Link
                    href={open ? "/" : `/profiles/${p.id}`}
                    className={clsx(
                      "card flex w-full flex-col items-center gap-2 p-4 transition hover:border-accent active:scale-[.98]",
                      open && "border-accent",
                    )}
                  >
                    <span className="relative grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-3xl">
                      {p.emoji}
                      {!open && (
                        <span className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-muted">
                          <Lock size={12} />
                        </span>
                      )}
                    </span>
                    <span className="max-w-full truncate font-semibold">{p.name || "Sans nom"}</span>
                    {open ? (
                      <span className="text-[10px] font-semibold tracking-wide text-accent uppercase">Ouvert</span>
                    ) : (
                      !p.pinHash && <span className="text-[10px] font-semibold tracking-wide text-warning uppercase">Code à créer</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <details open={empty} className="card">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <Plus size={18} className="text-accent" /> Ajouter un profil
          </summary>
          <ActionForm action={createProfile} submit="Créer le profil" pendingLabel="Création…" className="mt-4">
            <div>
              <label className="label" htmlFor="name">Prénom</label>
              <input id="name" name="name" required maxLength={60} autoComplete="given-name" className="input" />
            </div>
            <EmojiPicker />
            <NewPinFields />
            <p className="text-xs text-muted">
              Le code (4 à 6 chiffres) sera demandé pour ouvrir ce profil. Tu pourras ensuite activer Face ID depuis ton profil.
            </p>
          </ActionForm>
        </details>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          {me && <Link href="/" className="text-muted underline">Retour à l&apos;app</Link>}
          {me && (
            <form action={lockProfile}>
              <button className="text-muted underline">Verrouiller {me.name}</button>
            </form>
          )}
          <form action={logout}>
            <button className="text-muted underline">Se déconnecter</button>
          </form>
        </div>
      </div>
    </main>
  );
}
