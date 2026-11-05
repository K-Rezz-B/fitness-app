"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, CloudUpload } from "lucide-react";
import { syncOfflineWorkout } from "@/app/actions";
import { readOutbox, removeFromOutbox, subscribeOutbox } from "@/lib/outbox";

/** Envoie les séances saisies hors-ligne dès que le réseau revient, et affiche ce qui reste en attente. */
export function OutboxSync({ pid }: { pid: number }) {
  const router = useRouter();
  const pending = useSyncExternalStore(subscribeOutbox, () => readOutbox().filter((p) => p.pid === pid).length, () => 0);
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);

  const flush = useCallback(async () => {
    const mine = readOutbox().filter((p) => p.pid === pid);
    if (busy.current || !mine.length || !navigator.onLine) return;
    busy.current = true;
    let sent = 0;
    try {
      for (const p of mine) {
        const r = await syncOfflineWorkout(p.pid, p.id, p.fields);
        if (r.ok) {
          removeFromOutbox(p.id);
          sent++;
        }
      }
    } catch {
      // toujours hors-ligne : on réessaiera au prochain retour du réseau
    } finally {
      busy.current = false;
    }
    if (sent) {
      setToast(`☁️ ${sent} séance${sent > 1 ? "s" : ""} hors-ligne synchronisée${sent > 1 ? "s" : ""}`);
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    }
  }, [pid, router]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [flush]);

  if (!toast && !pending) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <button
        type="button"
        onClick={flush}
        className="animate-fade-up pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface-2/95 px-4 py-2 text-xs font-medium text-ink shadow-xl backdrop-blur"
      >
        {toast ?? (
          <>
            {navigator.onLine ? <CloudUpload size={14} className="text-accent" /> : <CloudOff size={14} className="text-warning" />}
            {pending} séance{pending > 1 ? "s" : ""} en attente d&apos;envoi
          </>
        )}
      </button>
    </div>
  );
}
