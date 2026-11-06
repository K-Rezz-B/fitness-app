"use client";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import clsx from "clsx";
import { toast } from "./toaster";

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} aria-hidden className={clsx("shrink-0 animate-spin", className)} />;
}

/**
 * Formulaire branché sur une server action, avec retour visuel :
 * toast de succès (y compris quand l'action redirige), toast d'erreur au lieu d'un écran d'erreur,
 * et `collapse` referme le <details> qui le contient une fois enregistré.
 */
export function Form({
  action,
  success,
  error = "Oups, ça n'a pas marché. Réessaie.",
  collapse,
  onDone,
  className,
  children,
}: {
  action: (f: FormData) => Promise<unknown>;
  success?: string;
  error?: string;
  collapse?: boolean;
  /** Appelé après un enregistrement réussi (composants client uniquement) */
  onDone?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (f) => {
        try {
          await action(f);
        } catch (e) {
          try {
            unstable_rethrow(e); // redirection (ou page introuvable) : c'est Next qui s'en charge
          } catch (navigation) {
            if (success) toast(success);
            throw navigation;
          }
          toast(navigator.onLine ? error : "Pas de réseau : réessaie quand tu seras connecté.", { kind: "error" });
          return;
        }
        if (success) toast(success);
        if (collapse) ref.current?.closest("details")?.removeAttribute("open");
        onDone?.();
      }}
    >
      {children}
    </form>
  );
}

/** Bouton d'envoi : désactivé avec un indicateur tant que l'action tourne (pas de double envoi). */
export function SubmitButton({ children, pendingLabel, className, ...rest }: ComponentProps<"button"> & { pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={pending || rest.disabled} aria-busy={pending} className={className}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Bouton de suppression en deux temps : le premier tap le passe en rouge « Supprimer ? »,
 * le second (dans les 3 s) confirme. Plus rapide et plus net qu'une boîte de dialogue.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Supprimer ?",
  className,
  armedClassName = "border-critical bg-critical text-white hover:bg-critical",
  ...rest
}: ComponentProps<"button"> & { confirmLabel?: ReactNode; armedClassName?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      {...rest}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (armed) return;
        e.preventDefault();
        setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      className={clsx(className, "transition-all", (armed || pending) && armedClassName)}
    >
      {pending ? <Spinner /> : armed ? <span className="animate-pop whitespace-nowrap">{confirmLabel}</span> : children}
    </button>
  );
}
