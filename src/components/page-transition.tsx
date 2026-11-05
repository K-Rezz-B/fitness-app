"use client";
import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Fondu entre les pages (seulement au changement d'URL, pas à chaque revalidation) + cartes en cascade. */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={path} enter="page" exit="page" default="none">
      <div className="stagger mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 md:py-8">{children}</div>
    </ViewTransition>
  );
}
