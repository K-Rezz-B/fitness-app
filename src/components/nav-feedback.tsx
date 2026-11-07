"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navDirection, type NavDir } from "@/lib/nav-direction";

const html = () => document.documentElement;

/**
 * Retour visuel des navigations :
 * - sens de la transition de page (avant/arrière, onglet de gauche/droite), lu par le CSS (`:root[data-nav=…]`) ;
 * - au bouton retour / geste de balayage, Next restaure la page d'un coup (pas de View Transition) :
 *   la page restaurée glisse alors depuis le bon côté (`:root[data-pop=…]`) ;
 * - fine barre de progression en haut quand la page met du temps à arriver (rien si c'est instantané).
 */
export function NavFeedback() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const bar = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const lastPath = useRef(path);
  const pop = useRef<{ dir?: NavDir; at: number } | null>(null);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      startedAt.current = performance.now();
      if (bar.current) bar.current.dataset.state = "loading";
      clearTimeout(safety);
      safety = setTimeout(() => {
        if (bar.current) bar.current.dataset.state = "idle";
        delete html().dataset.nav;
      }, 12_000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname.startsWith("/api/")) return;
      if (to.pathname === location.pathname && to.search === location.search) return; // même page (ancre, onglet actif)
      const dir = navDirection(location.pathname, to.pathname);
      if (dir) html().dataset.nav = dir;
      else delete html().dataset.nav;
      start();
    };
    // Retour / avancer : Next restaure la page dès l'événement popstate, avant nos écouteurs. On repère donc
    // le déplacement dans l'historique plus tôt, via l'API Navigation (événement « navigate », URL pas encore changée).
    const markPop = (from: string, to: string) => {
      delete html().dataset.nav;
      pop.current = { dir: navDirection(from, to), at: performance.now() };
      start();
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const onNavigate = (e: Event) => {
      const { navigationType, destination } = e as Event & { navigationType: string; destination: { url: string } };
      if (navigationType !== "traverse") return;
      const to = new URL(destination.url).pathname;
      if (to !== location.pathname) markPop(location.pathname, to);
    };
    // Navigateurs sans API Navigation : popstate, seulement si la page n'a pas déjà été restaurée
    const onPop = () => {
      if (!navigation && lastPath.current !== location.pathname) markPop(lastPath.current, location.pathname);
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop, true);
    navigation?.addEventListener("navigate", onNavigate);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop, true);
      navigation?.removeEventListener("navigate", onNavigate);
      clearTimeout(safety);
    };
  }, []);

  // Page restaurée par le bouton retour : glissement d'arrivée, posé avant l'affichage
  useLayoutEffect(() => {
    const p = pop.current;
    pop.current = null;
    if (!p?.dir || performance.now() - p.at > 8000) return;
    html().dataset.pop = p.dir;
    const t = setTimeout(() => delete html().dataset.pop, 450);
    return () => {
      clearTimeout(t);
      delete html().dataset.pop;
    };
  }, [path]);

  // Page arrivée : on termine la barre (ou on l'efface si c'était quasi instantané)
  useEffect(() => {
    lastPath.current = path;
    const arrivedAt = performance.now();
    const el = bar.current;
    if (el?.dataset.state === "loading") el.dataset.state = arrivedAt - startedAt.current < 180 ? "idle" : "done";
    const t = setTimeout(() => {
      if (startedAt.current > arrivedAt) return; // une autre navigation est déjà partie
      delete html().dataset.nav; // la transition est finie : ne pas influencer la suivante
      if (el?.dataset.state === "done") el.dataset.state = "idle";
    }, 700);
    return () => clearTimeout(t);
  }, [path, search]);

  return <div ref={bar} aria-hidden data-state="idle" className="nav-progress" />;
}
