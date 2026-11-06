"use client";
import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, CalendarClock, PlaySquare, Brain, Plus, UserRound, ArrowLeftRight, Apple, Trophy, ChartLine } from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/workouts", label: "Séances", icon: Dumbbell },
  { href: "/planning", label: "Planning", icon: CalendarClock },
  { href: "/videos", label: "Vidéos", icon: PlaySquare },
  { href: "/coach", label: "Coach", icon: Brain },
];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/**
 * Onglet actif « optimiste » : il s'allume dès le tap, sans attendre que la page arrive.
 * Un tap sur l'onglet de la page affichée remonte en haut de la page (comme sur iOS).
 */
function useNavState() {
  const path = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  // Page arrivée (ou autre navigation) : l'onglet « en attente » est oublié, sinon il se rallumerait
  // en revenant plus tard sur la page de départ.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setPending(null);
  }
  const shown = pending && pending.from === path ? pending.href : path;
  const onClick = (href: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (href === path) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPending({ href, from: path });
  };
  return { path: shown, onClick };
}

export function Sidebar({ profile }: { profile: { name: string; emoji: string } }) {
  const { path, onClick } = useNavState();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex" style={{ viewTransitionName: "sidebar" }}>
      <Link href="/" onClick={onClick("/")} className="mb-8 flex items-center gap-2 px-2 text-xl font-bold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-black">⚡</span>
        FitPulse
      </Link>
      <Link href="/workouts/new" className="btn-primary mb-6">
        <Plus size={18} /> Nouvelle séance
      </Link>
      <nav className="flex flex-col gap-1">
        {[
          ...ITEMS,
          { href: "/progress", label: "Progrès", icon: Trophy },
          { href: "/evolution", label: "Évolution", icon: ChartLine },
          { href: "/integrations", label: "Apple", icon: Apple },
          { href: "/profile", label: "Profil", icon: UserRound },
        ].map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={ITEMS.some((i) => i.href === href) || null}
              onClick={onClick(href)}
              aria-current={on ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[.98]",
                on ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <Icon size={18} className={clsx("transition-colors", on && "text-accent")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/profiles"
        title="Changer de profil"
        className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 transition hover:border-muted active:scale-[.98]"
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
  const nav = useNavState();
  // Records, bilan, défis et évolution sont rangés sous l'onglet Séances sur mobile
  const path = nav.path.replace(/^\/(progress|bilan|defis|evolution)\b.*/, "/workouts");
  const current = ITEMS.findIndex((i) => active(path, i.href));
  return (
    <nav
      className="tabbar pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl md:hidden"
      style={{ viewTransitionName: "tabbar" }}
    >
      <div className="relative mx-auto grid max-w-lg grid-cols-5 px-2 pt-2">
        {/* Pastille qui glisse sous l'onglet actif */}
        {current >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 left-2 h-[calc(100%-0.25rem)] w-[calc((100%-1rem)/5)] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ transform: `translateX(${current * 100}%)` }}
          >
            <span className="mx-auto block h-full w-14 rounded-2xl bg-accent/10" />
          </span>
        )}
        {ITEMS.map(({ href, label, icon: Icon }, i) => {
          const on = i === current;
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={nav.onClick(href)}
              aria-current={on ? "page" : undefined}
              className={clsx(
                "relative flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors active:opacity-70",
                on ? "text-accent" : "text-muted",
              )}
            >
              <Icon
                size={22}
                strokeWidth={on ? 2.4 : 1.8}
                className={clsx("transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]", on && "-translate-y-0.5 scale-110")}
              />
              {label}
            </Link>
          );
        })}
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
      className="fab animate-pop fixed right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-black shadow-lg shadow-accent/20 active:scale-90 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)", viewTransitionName: "fab" }}
    >
      <Plus size={26} strokeWidth={2.5} />
    </Link>
  );
}
