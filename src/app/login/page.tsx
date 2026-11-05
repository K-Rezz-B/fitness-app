import type { Metadata } from "next";
import { LoginForm } from "./form";
import { PasskeyLoginButton } from "@/components/passkeys";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="glow grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl text-black">⚡</div>
          <h1 className="text-3xl font-bold tracking-tight">FitPulse</h1>
          <p className="mt-2 text-sm text-muted">Ton coach perso. Chaque séance compte.</p>
        </div>
        <LoginForm />
        <PasskeyLoginButton />
      </div>
    </main>
  );
}
