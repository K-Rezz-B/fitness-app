"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type NavEntry = { url: string | null };
type NavigationApi = { canGoBack: boolean; currentEntry: { index: number } | null; entries(): NavEntry[] };

/** La page précédente de l'historique est-elle une page de l'app ? (API Navigation, absente de certains navigateurs) */
function canGoBackInApp() {
  const nav = (window as Window & { navigation?: NavigationApi }).navigation;
  if (!nav?.canGoBack || !nav.currentEntry) return false;
  const prev = nav.entries()[nav.currentEntry.index - 1]?.url;
  if (!prev) return false;
  const url = new URL(prev);
  return url.origin === location.origin && !/^\/(login|profiles)\b/.test(url.pathname);
}

/**
 * « ‹ Retour » : revient à la page précédente (scroll conservé) si on vient de l'app,
 * sinon ouvre la page parente (arrivée directe, notification, app relancée…).
 * Indispensable en mode app (PWA) où il n'y a pas de bouton retour ; masqué sur ordinateur (barre latérale).
 */
export function BackLink({ fallback, label = "Retour" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        if (!canGoBackInApp()) return;
        e.preventDefault();
        router.back();
      }}
      className="-ml-1.5 mb-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 pl-0.5 text-sm font-medium text-accent transition active:scale-95 active:opacity-60 md:hidden"
    >
      <ChevronLeft size={18} strokeWidth={2.4} /> {label}
    </Link>
  );
}
