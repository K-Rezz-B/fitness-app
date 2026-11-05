"use client";
import { useActionState, useRef, type ReactNode, type Ref } from "react";
import clsx from "clsx";

/** Retour d'une server action de formulaire : message d'erreur ou de confirmation (null = rien à afficher). */
export type FormState = { ok: boolean; message: string } | null;

/** Formulaire branché sur une server action `(état, formData)` : affiche son message sous les champs. */
export function ActionForm({
  action,
  children,
  submit,
  pendingLabel = "…",
  danger,
  className,
}: {
  action: (prev: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode;
  submit: ReactNode;
  pendingLabel?: string;
  danger?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={clsx("space-y-4", className)}>
      {children}
      {state && (
        <p role="status" className={clsx("text-sm", state.ok ? "text-accent" : "text-critical")}>
          {state.message}
        </p>
      )}
      <button className={danger ? "btn-ghost text-critical" : "btn-primary w-full"} disabled={pending}>
        {pending ? pendingLabel : submit}
      </button>
    </form>
  );
}

/** Champ code PIN : 4 à 6 chiffres, pavé numérique sur iPhone, saisie masquée. */
export function PinInput({
  name = "pin",
  label = "Code PIN",
  autoFocus,
  ref,
  onInput,
}: {
  name?: string;
  label?: string;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
  onInput?: () => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={`pin-${name}`}>{label}</label>
      <input
        id={`pin-${name}`}
        ref={ref}
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]{4,6}"
        minLength={4}
        maxLength={6}
        required
        autoFocus={autoFocus}
        autoComplete="off"
        title="4 à 6 chiffres"
        onInput={onInput}
        className="input text-center font-mono text-2xl tracking-[0.5em]"
      />
    </div>
  );
}

/** Nouveau code saisi deux fois (`pin` + `pinConfirm`), vérifiés côté navigateur avant envoi. */
export function NewPinFields({ label = "Code PIN", autoFocus }: { label?: string; autoFocus?: boolean }) {
  const pin = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLInputElement>(null);
  const check = () => {
    const c = confirm.current;
    if (c) c.setCustomValidity(c.value && c.value !== pin.current?.value ? "Les deux codes ne correspondent pas" : "");
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <PinInput ref={pin} label={label} autoFocus={autoFocus} onInput={check} />
      <PinInput ref={confirm} name="pinConfirm" label="Confirmation" onInput={check} />
    </div>
  );
}
