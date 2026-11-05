import Link from "next/link";
import { Shuffle } from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/templates";
import { typeInfo } from "@/lib/constants";

/**
 * Programmes prêts. Par défaut, seulement ceux faisables avec le matériel du profil ;
 * « Tous les programmes » affiche le reste (ex. séance ponctuelle en salle).
 */
export function TemplatePicker({ current, doable, showAll }: { current?: string; doable: Template[]; showAll: boolean }) {
  const shown = showAll ? TEMPLATES : doable;
  const list = current && !shown.some((t) => t.id === current) ? [...shown, ...TEMPLATES.filter((t) => t.id === current)] : shown;
  const others = list.filter((t) => t.id !== current);
  const pool = others.length ? others : list;
  // rotation pseudo-aléatoire : chaque clic propose un autre programme de la liste
  const random = pool[(Math.max(0, list.findIndex((t) => t.id === current)) + 7) % pool.length];
  const q = (id: string) => `/workouts/new?template=${id}${showAll ? "&all=1" : ""}`;
  const hidden = TEMPLATES.length - doable.length;
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label mb-0">Programmes prêts</span>
        <span className="flex gap-2">
          {hidden > 0 && (
            <Link href={showAll ? `/workouts/new${current ? `?template=${current}` : ""}` : `/workouts/new?all=1${current ? `&template=${current}` : ""}`} className="chip">
              {showAll ? "Adaptés à mon matériel" : `Tous les programmes (+${hidden})`}
            </Link>
          )}
          {random && <Link href={q(random.id)} className="chip text-accent"><Shuffle size={12} /> Surprends-moi</Link>}
        </span>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {list.map((t) => (
          <Link
            key={t.id}
            href={q(t.id)}
            className={`shrink-0 rounded-2xl border px-3 py-2 text-xs ${current === t.id ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
          >
            <span className="mr-1">{typeInfo(t.type).emoji}</span>
            <b>{t.title}</b>
            <span className="ml-1 text-muted">{t.durationMin}′</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
