import clsx from "clsx";
import type { ReactNode } from "react";
import { BackLink } from "./back-link";

/*
 * Squelettes affichés instantanément pendant qu'une page charge (fichiers loading.tsx).
 * Ils reprennent la mise en page réelle (titre compris) pour que le contenu arrive « en place ».
 */

export function Bone({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

function Card({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

/** Titre de carte + zone de contenu (graphique, liste…) */
function Block({ h = "h-40", className }: { h?: string; className?: string }) {
  return (
    <Card className={className}>
      <Bone className="h-4 w-36" />
      <Bone className={clsx("mt-4 w-full", h)} />
    </Card>
  );
}

function Page({ title, back, children }: { title?: string; back?: string; children: ReactNode }) {
  return (
    <div className="skeleton-page" aria-busy="true">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {back && <BackLink fallback={back} />}
          {title ? <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1> : <Bone className="h-8 w-52" />}
          <Bone className="mt-2 h-3.5 w-44" />
        </div>
        <Bone className="h-10 w-10 shrink-0 rounded-full md:hidden" />
      </header>
      <span className="sr-only" role="status">Chargement…</span>
      {children}
    </div>
  );
}

function Stats({ n = 4 }: { n?: number }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <Card key={i}>
          <Bone className="h-3 w-20" />
          <Bone className="mt-3 h-8 w-24" />
          <Bone className="mt-2 h-3 w-28" />
        </Card>
      ))}
    </div>
  );
}

/** Raccourcis Records / Bilan / Défis / Évolution */
function Shortcuts() {
  return (
    <div className="mb-4 grid grid-cols-4 gap-2">
      {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-14 rounded-3xl sm:h-12" />)}
    </div>
  );
}

function Rows({ n = 4 }: { n?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="card flex items-center gap-4 p-4">
          <Bone className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-4 w-2/5" />
            <Bone className="h-3 w-3/5" />
          </div>
          <Bone className="h-8 w-10" />
        </li>
      ))}
    </ul>
  );
}

export function HomeSkeleton() {
  return (
    <Page>
      <section className="glow mb-4 rounded-3xl border border-line p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Bone className="h-[148px] w-[148px] shrink-0 rounded-full" />
          <div className="w-full flex-1 space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <Bone className="mb-1.5 h-3 w-1/3" />
                <Bone className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <Stats />
      <Shortcuts />
      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <Bone className="h-4 w-32" />
          <Bone className="mt-4 h-8 w-8" />
          <Bone className="mt-3 h-5 w-3/5" />
          <Bone className="mt-2 h-3 w-4/5" />
          <Bone className="mt-4 h-16 w-full" />
          <Bone className="mt-4 h-10 w-32 rounded-2xl" />
        </Card>
        <Block h="h-64" className="lg:col-span-3" />
      </div>
    </Page>
  );
}

export function ListSkeleton({ title }: { title: string }) {
  return (
    <Page title={title}>
      <Shortcuts />
      <div className="mb-2 flex justify-between px-1">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-24" />
      </div>
      <Rows n={5} />
    </Page>
  );
}

export function WorkoutFormSkeleton({ title, back, picker }: { title: string; back: string; picker?: boolean }) {
  return (
    <Page title={title} back={back}>
      {picker && (
        <div className="mb-4">
          <Bone className="mb-2 h-3 w-32" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }, (_, i) => <Bone key={i} className="h-9 w-36 shrink-0 rounded-2xl" />)}
          </div>
        </div>
      )}
      <div className="space-y-4">
        <Card className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-48" />
            <Bone className="h-3 w-64 max-w-full" />
          </div>
          <Bone className="h-10 w-40 rounded-2xl" />
        </Card>
        <Card>
          <Bone className="mb-2 h-3 w-28" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-[74px] rounded-2xl" />)}
          </div>
        </Card>
        <Card className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={i === 0 ? "sm:col-span-2" : ""}>
              <Bone className="mb-2 h-3 w-24" />
              <Bone className="h-11 w-full" />
            </div>
          ))}
        </Card>
      </div>
    </Page>
  );
}

export function PlanningSkeleton() {
  return (
    <Page title="Planning">
      <Card className="mb-4">
        <div className="mb-3 flex justify-between">
          <Bone className="h-4 w-28" />
          <Bone className="h-4 w-10" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}
        </div>
      </Card>
      <section className="glow mb-4 rounded-3xl border border-line p-5">
        <Bone className="h-5 w-56" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-14 rounded-2xl" />)}
        </div>
      </section>
      <Rows n={3} />
    </Page>
  );
}

export function VideosSkeleton() {
  return (
    <Page title="Vidéos">
      <div className="mb-3 flex gap-2">
        <Bone className="h-11 flex-1" />
        <Bone className="h-11 w-12 rounded-2xl sm:w-28" />
      </div>
      <div className="mb-4 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="h-7 w-20 shrink-0 rounded-full" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card overflow-hidden p-0">
            <Bone className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Bone className="h-4 w-4/5" />
              <Bone className="h-3 w-1/2" />
              <Bone className="mt-3 h-9 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/** Pages de statistiques : chiffres clés + graphiques */
export function ChartsSkeleton({ title, back, shortcuts = true }: { title: string; back?: string; shortcuts?: boolean }) {
  return (
    <Page title={title} back={back}>
      {shortcuts && <Shortcuts />}
      <Stats />
      <div className="grid gap-4 lg:grid-cols-2">
        <Block h="h-56" />
        <Block h="h-56" />
      </div>
    </Page>
  );
}

/** Pages de réglages : cartes de formulaires */
export function SettingsSkeleton({ title, back }: { title: string; back?: string }) {
  return (
    <Page title={title} back={back}>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i} className="space-y-3">
            <Bone className="h-5 w-40" />
            {Array.from({ length: 4 }, (_, j) => <Bone key={j} className="h-11 w-full" />)}
            <Bone className="h-10 w-full rounded-2xl" />
          </Card>
        ))}
      </div>
      <Block h="h-16" className="mt-4" />
    </Page>
  );
}
