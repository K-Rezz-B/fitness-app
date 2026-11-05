"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ScanFace } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { passkeyLoginOptions, passkeyRegistrationOptions, verifyPasskeyLogin, verifyPasskeyRegistration } from "@/app/apple-actions";

const noop = () => () => {};
const useWebAuthn = () => useSyncExternalStore(noop, browserSupportsWebAuthn, () => false);

const explain = (e: unknown) => {
  const name = (e as Error)?.name;
  if (name === "NotAllowedError") return "Annulé ou délai dépassé.";
  if (name === "InvalidStateError") return "Cet appareil est déjà enregistré pour ce profil.";
  return (e as Error)?.message ?? "Erreur inattendue";
};

/** Page /login : connexion par Face ID / Touch ID (ouvre directement le profil de la passkey). */
export function PasskeyLoginButton() {
  const supported = useWebAuthn();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!supported) return null;
  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const optionsJSON = await passkeyLoginOptions();
              const err = await verifyPasskeyLogin(await startAuthentication({ optionsJSON }));
              if (err) setError(err);
            } catch (e) {
              setError(explain(e));
            }
          })
        }
      >
        <ScanFace size={18} /> {pending ? "Vérification…" : "Face ID / Touch ID"}
      </button>
      {error && <p className="text-center text-sm text-critical">{error}</p>}
    </div>
  );
}

/** Page Apple : enregistre une passkey pour le profil actif sur cet appareil. */
export function PasskeyRegisterButton() {
  const supported = useWebAuthn();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!supported) return <p className="text-sm text-muted">Ce navigateur ne gère pas les passkeys.</p>;
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const optionsJSON = await passkeyRegistrationOptions();
              const err = await verifyPasskeyRegistration(await startRegistration({ optionsJSON }));
              setMsg(err ? { ok: false, text: err } : { ok: true, text: "Passkey enregistrée : tu peux te connecter par Face ID / Touch ID." });
            } catch (e) {
              setMsg({ ok: false, text: explain(e) });
            }
          })
        }
      >
        <ScanFace size={18} /> {pending ? "En cours…" : "Activer sur cet appareil"}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-accent" : "text-critical"}`}>{msg.text}</p>}
    </div>
  );
}
