import Link from "next/link";
import { Shuffle } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { typeInfo } from "@/lib/constants";

export function TemplatePicker({ current }: { current?: string }) {
  const others = TEMPLATES.filter((t) => t.id !== current);
  // rotation pseudo-aléatoire (pas 7, premier avec 18) : chaque clic propose un autre programme
  const random = others[(TEMPLATES.findIndex((t) => t.id === current) + 7 + others.length) % others.length];
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Programmes prêts</span>
        <Link href={`/workouts/new?template=${random.id}`} className="chip text-accent"><Shuffle size={12} /> Surprends-moi</Link>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/workouts/new?template=${t.id}`}
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
