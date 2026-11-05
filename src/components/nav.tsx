"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, CalendarClock, PlaySquare, Brain, Plus, UserRound, ArrowLeftRight } from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/workouts", label: "Séances", icon: Dumbbell },
  { href: "/planning", label: "Planning", icon: CalendarClock },
  { href: "/videos", label: "Vidéos", icon: PlaySquare },
  { href: "/coach", label: "Coach", icon: Brain },
];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Sidebar({ profile }: { profile: { name: string; emoji: string } }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2 text-xl font-bold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-black">⚡</span>
        FitPulse
      </Link>
      <Link href="/workouts/new" className="btn-primary mb-6">
        <Plus size={18} /> Nouvelle séance
      </Link>
      <nav className="flex flex-col gap-1">
        {[...ITEMS, { href: "/profile", label: "Profil", icon: UserRound }].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active(path, href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icon size={18} className={active(path, href) ? "text-accent" : ""} />
            {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/profiles"
        title="Changer de profil"
        className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 transition hover:border-muted"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg">{profile.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{profile.name || "Mon profil"}</span>
          <span className="block text-xs text-muted">Changer de profil</span>
        </span>
        <ArrowLeftRight size={16} className="shrink-0 text-muted" />
      </Link>
    </aside>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-2">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-col items-center gap-1 py-1 text-[10px] font-medium",
              active(path, href) ? "text-accent" : "text-muted",
            )}
          >
            <Icon size={22} strokeWidth={active(path, href) ? 2.4 : 1.8} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Fab() {
  const path = usePathname();
  if (path.startsWith("/workouts/")) return null;
  return (
    <Link
      href="/workouts/new"
      aria-label="Nouvelle séance"
      className="fixed right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-black shadow-lg shadow-accent/20 active:scale-95 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      <Plus size={26} strokeWidth={2.5} />
    </Link>
  );
}
