import Link from "next/link";
import clsx from "clsx";
import { Trophy, BarChart3, Medal } from "lucide-react";

/** Raccourcis entre les pages Records / Bilan / Défis. */
export function ProgressLinks({ current }: { current?: "progress" | "bilan" | "defis" }) {
  const items = [
    { id: "progress", href: "/progress", label: "Records", icon: Trophy },
    { id: "bilan", href: "/bilan", label: "Bilan", icon: BarChart3 },
    { id: "defis", href: "/defis", label: "Défis", icon: Medal },
  ] as const;
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {items.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={clsx(
            "card flex items-center justify-center gap-2 p-3 text-sm font-semibold transition hover:border-muted active:scale-[.98]",
            current === id && "border-accent/40 bg-accent/5 text-accent",
          )}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
    </div>
  );
}
