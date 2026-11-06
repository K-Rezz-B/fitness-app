"use client";
import { useEffect, useTransition } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Spinner } from "@/components/forms";

/** Erreur dans une page : on garde la navigation et on propose de réessayer, au lieu d'un écran blanc. */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="animate-pop card mt-6 flex flex-col items-center py-12 text-center">
      <div className="text-5xl">{offline ? "📴" : "😵‍💫"}</div>
      <h1 className="mt-3 text-lg font-bold">{offline ? "Pas de réseau" : "Oups, un souci de chargement"}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {offline
          ? "Cette page a besoin d'internet. Tes séances saisies hors-ligne seront envoyées dès le retour du réseau."
          : "Ça arrive (réseau capricieux, serveur qui se réveille…). Réessaie, ça passe en général du premier coup."}
      </p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => startTransition(retry)} disabled={pending} className="btn-primary">
          {pending ? <Spinner /> : <RotateCcw size={16} />} Réessayer
        </button>
        <Link href="/" className="btn-ghost">Accueil</Link>
      </div>
    </div>
  );
}
