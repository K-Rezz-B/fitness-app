import Link from "next/link";

export default function NotFound() {
  return (
    <div className="animate-pop card mt-6 flex flex-col items-center py-12 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-3 text-lg font-bold">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Cette séance ou cette page n&apos;existe plus (supprimée, ou lien d&apos;un autre profil).</p>
      <div className="mt-5 flex gap-2">
        <Link href="/workouts" className="btn-primary">Mes séances</Link>
        <Link href="/" className="btn-ghost">Accueil</Link>
      </div>
    </div>
  );
}
