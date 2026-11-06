/**
 * Sens d'une navigation entre deux pages, pour orienter l'animation de transition :
 * - « forward » / « back » : on descend dans une page de détail / on remonte (glissement marqué) ;
 * - « right » / « left » : on change d'onglet ou de page sœur (léger glissement latéral).
 */
export type NavDir = "forward" | "back" | "left" | "right";

type Place = { path: string; tab: number; depth: number; order?: number };

// Ordre de la barre d'onglets. Records, Bilan, Défis et Évolution sont rangés sous « Séances » (cf. TabBar).
const PLACES: Place[] = [
  { path: "/", tab: 0, depth: 0 },
  { path: "/workouts", tab: 1, depth: 0 },
  { path: "/progress", tab: 1, depth: 1, order: 0 },
  { path: "/bilan", tab: 1, depth: 1, order: 1 },
  { path: "/defis", tab: 1, depth: 1, order: 2 },
  { path: "/evolution", tab: 1, depth: 1, order: 3 },
  { path: "/planning", tab: 2, depth: 0 },
  { path: "/videos", tab: 3, depth: 0 },
  { path: "/coach", tab: 4, depth: 0 },
  { path: "/profile", tab: 5, depth: 0 },
  { path: "/integrations", tab: 5, depth: 1 },
];

const segments = (path: string) => path.split("/").filter(Boolean).length;

function locate(path: string) {
  let best: Place | undefined;
  for (const p of PLACES)
    if ((path === p.path || (p.path !== "/" && path.startsWith(`${p.path}/`))) && (!best || p.path.length > best.path.length)) best = p;
  return best && { ...best, depth: best.depth + segments(path) - segments(best.path) };
}

export function navDirection(from: string, to: string): NavDir | undefined {
  const a = locate(from);
  const b = locate(to);
  if (!a || !b || from === to) return undefined;
  if (a.tab !== b.tab) return b.tab > a.tab ? "right" : "left";
  if (a.depth !== b.depth) return b.depth > a.depth ? "forward" : "back";
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order) return b.order > a.order ? "right" : "left";
  return undefined;
}
