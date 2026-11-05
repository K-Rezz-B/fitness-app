"use client";
import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/apple-actions";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyToBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function detect(): Promise<State> {
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return isIOS() && !isStandalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await (await registration()).pushManager.getSubscription();
  return sub ? "on" : "off";
}

const LABEL: Record<State, string> = {
  loading: "Vérification…",
  unsupported: "Ce navigateur ne gère pas les notifications push.",
  install: "Sur iPhone, ajoute d'abord FitPulse à l'écran d'accueil (Safari › Partager › Sur l'écran d'accueil), puis ouvre l'app depuis son icône.",
  denied: "Notifications refusées : Réglages › Notifications › FitPulse pour les autoriser.",
  off: "Désactivées sur cet appareil.",
  on: "Activées sur cet appareil ✅",
};

export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    detect()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  if (!vapidKey)
    return <p className="text-sm text-warning">Définis <code>VAPID_PUBLIC_KEY</code> et <code>VAPID_PRIVATE_KEY</code> dans Vercel pour activer les notifications.</p>;

  const enable = () =>
    start(async () => {
      setMsg(null);
      // iOS : la demande de permission doit partir directement du geste (pas d'await avant)
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      try {
        const reg = await registration();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidKey) }));
        const err = await savePushSubscription(sub.toJSON());
        if (err) return setMsg(err);
        setState("on");
      } catch (e) {
        setMsg((e as Error).message);
      }
    });

  const disable = () =>
    start(async () => {
      setMsg(null);
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  return (
    <div className="space-y-3">
      <p className={`text-sm ${state === "on" ? "text-accent" : state === "denied" || state === "install" ? "text-warning" : "text-ink-2"}`}>{LABEL[state]}</p>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <button type="button" className="btn-primary" disabled={pending} onClick={enable}>
            <Bell size={16} /> Activer les notifications
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => setMsg(await sendTestPush()))}>
              <Send size={16} /> Envoyer un test
            </button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={disable}>
              <BellOff size={16} /> Désactiver ici
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-sm text-ink-2">{msg}</p>}
    </div>
  );
}
