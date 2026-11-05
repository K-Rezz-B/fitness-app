"use client";
import { useEffect, useRef, useState } from "react";

/** Nombre qui défile de 0 (ou de sa valeur précédente) jusqu'à `value`. */
export function CountUp({ value, decimals = 0, duration = 900 }: { value: number; decimals?: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    from.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(shown)}</>;
}
