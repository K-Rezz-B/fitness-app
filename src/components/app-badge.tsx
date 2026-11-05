"use client";
import { useEffect } from "react";

type BadgingNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Pastille sur l'icône de l'app (iOS 16.4+ installée, macOS, Chrome) : séances restantes cette semaine. */
export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as BadgingNavigator;
    if (!nav.setAppBadge) return;
    (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
  }, [count]);
  return null;
}
