import Link from "next/link";
import clsx from "clsx";
import { Trophy, BarChart3, Medal, ChartLine } from "lucide-react";

/** Raccourcis entre les pages Records / Bilan / Défis / Évolution. */
export function ProgressLinks({ current }: { current?: "progress" | "bilan" | "defis" | "evolution" }) {
  const items = [
    { id: "progress", href: "/progress", label: "Records", icon: Trophy },
    { id: "bilan", href: "/bilan", label: "Bilan", icon: BarChart3 },
    { id: "defis", href: "/defis", label: "Défis", icon: Medal },
    { id: "evolution", href: "/evolution", label: "Évolution", icon: ChartLine },
  ] as const;
  return (
    <div className="mb-4 grid grid-cols-4 gap-2">
      {items.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={clsx(
            "card flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-xs font-semibold transition hover:border-muted active:scale-[.98] sm:flex-row sm:gap-2 sm:p-3 sm:text-sm",
            current === id && "border-accent/40 bg-accent/5 text-accent",
          )}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
    </div>
  );
}
