/** Pluie de confettis plein écran (canvas éphémère, aucune dépendance). Ignorée si l'utilisateur réduit les animations. */
const COLORS = ["#c6f432", "#9d7bff", "#3987e5", "#d95926", "#199e70", "#fab219", "#f0efec"];

export function confetti({ count = 140, duration = 2800 }: { count?: number; duration?: number } = {}) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "100" });
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Deux canons en bas à gauche et à droite qui tirent vers le centre
  const parts = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = 9 + Math.random() * 9;
    return {
      x: left ? W * 0.1 : W * 0.9,
      y: H * 0.95,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[i % COLORS.length],
    };
  });

  const start = performance.now();
  requestAnimationFrame(function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.7) / (duration * 0.3));
    for (const p of parts) {
      p.vy += 0.25; // gravité
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.rot * 2), p.w, p.h * Math.cos(p.rot * 2)); // effet de rotation 3D
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  });
}

/** Petite vibration (Android ; ignorée sur iOS). */
export const buzz = (pattern: number | number[] = 30) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
};
