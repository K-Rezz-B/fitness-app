"use client";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, LoaderCircle } from "lucide-react";

const THRESHOLD = 72; // px de tirage (après résistance) pour déclencher
const MAX = 110;
const STALE_AFTER = 60_000; // retour dans l'app après 1 min : données rafraîchies

/**
 * Tirer la page vers le bas (tout en haut) pour recharger les données — l'app installée sur iPhone
 * n'a pas de bouton « recharger ». Rafraîchit aussi tout seul quand on revient dans l'app après un moment
 * (séances et activité importées entre-temps par les Raccourcis / la montre).
 */
export function PullToRefresh() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const indicator = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let startY = 0;
    let startX = 0;
    let pull = 0;
    let tracking = false;
    let decided = false;

    const paint = (px: number, animate = false) => {
      const el = indicator.current;
      if (!el) return;
      el.style.transition = animate ? "translate 0.3s var(--ease-fluid), opacity 0.3s" : "none";
      el.style.translate = `-50% ${px - 56}px`;
      el.style.opacity = String(Math.min(1, px / THRESHOLD));
      if (icon.current) icon.current.style.rotate = `${px >= THRESHOLD ? 180 : (px / THRESHOLD) * 180}deg`;
    };

    const onStart = (e: TouchEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      tracking =
        e.touches.length === 1 &&
        window.scrollY <= 0 &&
        !document.querySelector("dialog[open]") &&
        !t?.closest("input, textarea, select, nav, [role=dialog], [data-no-pull]");
      decided = false;
      pull = 0;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        // geste horizontal (carrousel) ou vers le haut : ce n'est pas un « tirer pour rafraîchir »
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          tracking = false;
          return;
        }
      }
      pull = Math.min(MAX, Math.max(0, dy) * 0.5);
      paint(pull);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pull >= THRESHOLD) {
        navigator.vibrate?.(10);
        paint(THRESHOLD, true);
        startRefresh(() => router.refresh());
      } else paint(0, true);
    };

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER) startRefresh(() => router.refresh());
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  // Fin du rechargement : l'indicateur remonte
  useEffect(() => {
    const el = indicator.current;
    if (!refreshing && el && el.style.opacity !== "" && el.style.opacity !== "0") {
      el.style.transition = "translate 0.3s var(--ease-fluid), opacity 0.3s";
      el.style.translate = "-50% -56px";
      el.style.opacity = "0";
    }
  }, [refreshing]);

  return (
    <div
      ref={indicator}
      aria-hidden={!refreshing}
      role="status"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-50 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-2 text-accent opacity-0 shadow-xl shadow-black/40 md:hidden"
      style={{ translate: "-50% -56px" }}
    >
      {refreshing ? (
        <LoaderCircle size={18} className="animate-spin" />
      ) : (
        <div ref={icon}>
          <ArrowDown size={18} strokeWidth={2.5} />
        </div>
      )}
      <span className="sr-only">{refreshing ? "Actualisation…" : ""}</span>
    </div>
  );
}
