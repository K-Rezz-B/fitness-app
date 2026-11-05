/** File d'attente locale (localStorage) des séances saisies sans réseau. Code navigateur uniquement. */
export type PendingWorkout = { id: string; pid: number; createdAt: number; title: string; fields: Record<string, string> };

const KEY = "fitpulse:outbox";
const EVENT = "fitpulse:outbox";

export function readOutbox(): PendingWorkout[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: PendingWorkout[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

export function enqueueWorkout(pid: number, fd: FormData) {
  const fields: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$ACTION")) fields[k] = v;
  });
  const id = crypto.randomUUID();
  write([...readOutbox(), { id, pid, createdAt: Date.now(), title: fields.title || "Séance", fields }]);
  return id;
}

export const removeFromOutbox = (id: string) => write(readOutbox().filter((p) => p.id !== id));

/** Le serveur est-il injoignable ? (hors-ligne déclaré, ou requête qui échoue au niveau réseau) */
export const isNetworkError = (e: unknown) => !navigator.onLine || e instanceof TypeError;

/** Abonnement pour useSyncExternalStore : changements locaux et depuis un autre onglet. */
export function subscribeOutbox(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
