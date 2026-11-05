import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPasskeys, listProfiles } from "@/lib/data";
import { getActiveProfile, requireAuth } from "@/lib/session";
import { definePin, unlockWithPin } from "@/app/actions";
import { ActionForm, NewPinFields, PinInput } from "@/components/action-form";
import { PasskeyUnlockButton } from "@/components/passkeys";

export const metadata: Metadata = { title: "Déverrouiller" };

/** Écran de verrouillage d'un profil : code PIN ou Face ID (ou création du code pour un profil d'avant le verrou). */
export default async function Unlock({ params }: PageProps<"/profiles/[id]">) {
  await requireAuth();
  const [{ id }, all, me] = await Promise.all([params, listProfiles(), getActiveProfile()]);
  const p = all.find((x) => String(x.id) === id);
  if (!p) redirect("/profiles");
  if (me?.id === p.id && p.pinHash) redirect("/"); // déjà ouvert sur cet appareil
  const faceId = p.pinHash !== null && (await getPasskeys(p.id)).length > 0;

  return (
    <main className="glow pt-safe grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-surface-2 text-4xl">{p.emoji}</div>
          <h1 className="text-2xl font-bold tracking-tight">{p.name || "Sans nom"}</h1>
          <p className="mt-1 text-sm text-muted">
            {p.pinHash ? "Profil verrouillé" : "Ce profil n'a pas encore de code : choisis-le pour le protéger."}
          </p>
        </div>

        <div className="card">
          {p.pinHash ? (
            <ActionForm action={unlockWithPin} submit="Déverrouiller" pendingLabel="Vérification…">
              <input type="hidden" name="id" value={p.id} />
              <PinInput autoFocus={!faceId} />
            </ActionForm>
          ) : (
            <ActionForm action={definePin} submit="Enregistrer le code et ouvrir" pendingLabel="Enregistrement…">
              <input type="hidden" name="id" value={p.id} />
              <NewPinFields autoFocus />
              <p className="text-xs text-muted">4 à 6 chiffres, demandés à chaque ouverture du profil sur un nouvel appareil.</p>
            </ActionForm>
          )}
          {faceId && <PasskeyUnlockButton profileId={p.id} />}
        </div>

        <Link href="/profiles" className="mt-6 flex items-center justify-center gap-1 text-sm text-muted underline">
          <ArrowLeft size={14} /> Autres profils
        </Link>
      </div>
    </main>
  );
}
