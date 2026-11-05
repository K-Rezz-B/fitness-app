/**
 * Script du widget d'écran d'accueil / verrouillé pour l'app iOS gratuite Scriptable.
 * Généré par profil (contient l'URL de l'API et le jeton) → à coller tel quel dans Scriptable.
 */
export function scriptableWidget(opts: { apiUrl: string; token: string; name: string }): string {
  return `// FitPulse — widget Scriptable (${opts.name.replace(/[\r\n]/g, " ")})
// ⚠️ Contient ton jeton personnel : ne partage pas ce script.
// Tailles : petit, moyen, écran verrouillé (cercle / rectangle).
const API = ${JSON.stringify(opts.apiUrl)};
const TOKEN = ${JSON.stringify(opts.token)};

const C = {
  bg: new Color("#0a0a0b"),
  track: new Color("#26262b"),
  ink: new Color("#f4f4f5"),
  muted: new Color("#8b8b93"),
  accent: new Color("#c6f432"),
  violet: new Color("#9d7bff"),
  warn: new Color("#f5a524"),
};

async function load() {
  const r = new Request(API);
  r.headers = { Authorization: "Bearer " + TOKEN };
  r.timeoutInterval = 15;
  return r.loadJSON();
}

// Anneau de score (points le long du cercle : rendu net quelle que soit la taille)
function ring(score, size) {
  const lw = Math.round(size / 10);
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const c = size / 2;
  const r = c - lw / 2;
  ctx.setStrokeColor(C.track);
  ctx.setLineWidth(lw);
  ctx.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw));
  ctx.setFillColor(score >= 50 ? C.accent : C.warn);
  const steps = Math.round(Math.max(0, Math.min(100, score)) * 3.6);
  for (let i = 0; i <= steps; i++) {
    const a = (i / 360) * 2 * Math.PI - Math.PI / 2;
    ctx.fillEllipse(new Rect(c + r * Math.cos(a) - lw / 2, c + r * Math.sin(a) - lw / 2, lw, lw));
  }
  ctx.setTextAlignedCenter();
  ctx.setTextColor(C.ink);
  ctx.setFont(Font.boldRoundedSystemFont(size * 0.3));
  ctx.drawTextInRect(String(score), new Rect(0, c - size * 0.22, size, size * 0.36));
  ctx.setTextColor(C.muted);
  ctx.setFont(Font.mediumSystemFont(size * 0.09));
  ctx.drawTextInRect("FORME", new Rect(0, c + size * 0.13, size, size * 0.14));
  return ctx.getImage();
}

function bar(progress, w, h) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  ctx.addPath(track);
  ctx.setFillColor(C.track);
  ctx.fillPath();
  const p = Math.max(0, Math.min(1, progress));
  if (p > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 0, Math.max(h, w * p), h), h / 2, h / 2);
    ctx.addPath(fill);
    ctx.setFillColor(C.accent);
    ctx.fillPath();
  }
  return ctx.getImage();
}

function text(stack, value, size, color, weight) {
  const t = stack.addText(value);
  t.font = weight === "bold" ? Font.boldRoundedSystemFont(size) : Font.mediumSystemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

const weekLine = (d) => d.week.sessions + "/" + d.week.target + " séances";
const nextLine = (d) =>
  d.today.find((p) => !p.done)
    ? "⏳ " + d.today.find((p) => !p.done).time + " " + d.today.find((p) => !p.done).title
    : d.workedOutToday
      ? "✅ Séance du jour faite"
      : d.next
        ? d.next.emoji + " " + d.next.day + " " + d.next.time
        : "Aucun créneau planifié";

function small(w, d) {
  const top = w.addStack();
  top.centerAlignContent();
  top.addSpacer();
  top.addImage(ring(d.score, 64)).imageSize = new Size(64, 64);
  top.addSpacer();
  w.addSpacer(6);
  text(w, weekLine(d), 13, C.ink, "bold").centerAlignText();
  w.addSpacer(3);
  const img = w.addImage(bar(d.week.sessions / Math.max(1, d.week.target), 120, 6));
  img.imageSize = new Size(120, 6);
  img.centerAlignImage();
  w.addSpacer(4);
  text(w, "🔥 " + d.streak.days + " j · " + d.streak.weeks + " sem.", 11, C.muted).centerAlignText();
}

function medium(w, d) {
  const row = w.addStack();
  row.centerAlignContent();
  row.addImage(ring(d.score, 96)).imageSize = new Size(96, 96);
  row.addSpacer(14);
  const col = row.addStack();
  col.layoutVertically();
  text(col, d.profile.emoji + " " + d.profile.name, 12, C.muted);
  col.addSpacer(2);
  text(col, weekLine(d), 17, C.ink, "bold");
  col.addSpacer(4);
  col.addImage(bar(d.week.sessions / Math.max(1, d.week.target), 160, 7)).imageSize = new Size(160, 7);
  col.addSpacer(6);
  text(col, "🔥 " + d.streak.days + " j  ·  " + d.week.minutes + " min  ·  niv. " + d.level, 12, C.ink);
  col.addSpacer(3);
  text(col, nextLine(d), 12, C.violet);
  if (d.activity && d.activity.steps !== null) {
    col.addSpacer(2);
    text(col, "👟 " + d.activity.steps + " pas · 🔥 " + (d.activity.activeKcal || 0) + "/" + d.activity.moveGoalKcal + " kcal", 11, C.muted);
  }
}

function lockCircular(w, d) {
  w.addImage(ring(d.score, 60)).imageSize = new Size(60, 60);
}

function lockRect(w, d) {
  text(w, "⚡ Forme " + d.score + " · " + weekLine(d), 13, Color.white(), "bold");
  text(w, "🔥 " + d.streak.days + " j · " + nextLine(d), 12, Color.white());
}

async function build() {
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();
  const lock = family.startsWith("accessory");
  if (!lock) {
    w.backgroundColor = C.bg;
    w.setPadding(12, 14, 12, 14);
  }
  let d;
  try {
    d = await load();
  } catch (e) {
    text(w, "FitPulse hors ligne", 12, C.muted);
    return w;
  }
  if (!d || d.ok === false) {
    text(w, (d && d.message) || "FitPulse : erreur", 12, C.warn);
    return w;
  }
  w.url = d.url;
  if (family === "small") small(w, d);
  else if (family === "accessoryCircular") lockCircular(w, d);
  else if (lock) lockRect(w, d);
  else medium(w, d);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
