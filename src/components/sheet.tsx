"use client";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

/**
 * Feuille modale sur <dialog> natif : glisse du bas sur mobile (zoom léger sur ordinateur),
 * se ferme par Échap, tap à côté, bouton ou glissement vers le bas ; page derrière figée, focus piégé.
 * Le contenu reste affiché pendant l'animation de fermeture, puis est retiré (coupe une vidéo en cours).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className = "bg-surface",
  narrow,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Fond de la feuille (bg-surface par défaut) */
  className?: string;
  narrow?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      return;
    }
    if (d.open) d.close();
    const t = setTimeout(() => setMounted(false), 360);
    return () => clearTimeout(t);
  }, [open]);

  // Glisser vers le bas depuis l'en-tête pour fermer (mobile)
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = ref.current;
    if (!drag.current || !d) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    d.style.transition = "none";
    d.style.translate = `0 ${drag.current.dy}px`;
  };
  const onTouchEnd = () => {
    const d = ref.current;
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (!d) return;
    d.style.transition = "";
    d.style.translate = "";
    if (dy > 90) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-label={typeof title === "string" ? title : undefined}
      onCancel={(e) => {
        e.preventDefault(); // Échap : on passe par l'état pour garder l'animation de fermeture
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()} // tap sur le fond
      className={clsx(
        "sheet mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line p-0 text-ink shadow-2xl sm:m-auto sm:rounded-3xl sm:border-b",
        narrow ? "sm:max-w-sm" : "sm:max-w-lg",
        className,
      )}
    >
      <div className="pb-safe px-5 pt-2 sm:pt-5">
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} className="touch-none">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          {title !== undefined && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-lg font-bold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Fermer" autoFocus className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition active:scale-90">
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        {mounted && children}
      </div>
    </dialog>
  );
}
