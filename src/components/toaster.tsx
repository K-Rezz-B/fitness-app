"use client";
import { useSyncExternalStore } from "react";
import { Check, CircleAlert, Info } from "lucide-react";
import clsx from "clsx";

type Kind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: Kind; leaving?: boolean };

// Petit magasin global : toast() s'appelle de n'importe quel composant client, sans contexte React.
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Toast[] = [];
let seq = 0;

/** Message éphémère en haut de l'écran (confirmation d'enregistrement, erreur…). */
export function toast(message: string, { kind = "success", duration }: { kind?: Kind; duration?: number } = {}) {
  const id = ++seq;
  toasts = [...toasts.filter((t) => t.message !== message).slice(-2), { id, message, kind }];
  emit();
  setTimeout(() => dismiss(id), duration ?? (kind === "error" ? 4500 : 2600));
}

function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return;
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 220);
}

const ICONS = { success: Check, error: CircleAlert, info: Info };

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      {list.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <button
            type="button"
            key={t.id}
            onClick={() => dismiss(t.id)}
            data-leaving={t.leaving || undefined}
            role={t.kind === "error" ? "alert" : "status"}
            className="toast pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border border-line bg-surface-2/95 py-2 pr-4 pl-2.5 text-left text-sm font-medium text-ink shadow-xl shadow-black/40 backdrop-blur"
          >
            <span
              className={clsx(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                t.kind === "success" && "bg-accent text-black",
                t.kind === "error" && "bg-critical text-white",
                t.kind === "info" && "bg-surface text-ink-2",
              )}
            >
              <Icon size={14} strokeWidth={3} />
            </span>
            {t.message}
          </button>
        );
      })}
    </div>
  );
}
