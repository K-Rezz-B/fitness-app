import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { getActiveProfile } from "@/lib/session";
import { BackLink } from "./back-link";

/** En-tête de page. `back` : page parente (affiche « ‹ Retour » pour les sous-pages). */
export async function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: ReactNode; back?: string }) {
  const me = await getActiveProfile();
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <BackLink fallback={back} />}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <Link href="/profile" aria-label={`Profil ${me?.name ?? ""}`} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-lg transition active:scale-90 md:hidden">
          {me?.emoji ?? "💪"}
        </Link>
      </div>
    </header>
  );
}

export function Stat({ label, value, unit, sub, className }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; className?: string }) {
  return (
    <div className={clsx("card", className)}>
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-3xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <div className="text-5xl">{emoji}</div>
      <div className="mt-3 font-semibold">{title}</div>
      {children && <div className="mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="animate-grow-x h-full rounded-full bg-accent" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}
