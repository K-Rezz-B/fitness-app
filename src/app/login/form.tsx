"use client";
import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="input" />
      </div>
      {error && <p className="text-sm text-critical">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Connexion…" : "Entrer"}
      </button>
    </form>
  );
}
