import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pt-safe grid min-h-dvh place-items-center px-6">
      <div className="animate-pop flex flex-col items-center text-center">
        <div className="text-6xl">🧭</div>
        <h1 className="mt-4 text-xl font-bold">Page introuvable</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">Le lien est peut-être ancien. Retourne à l&apos;accueil pour continuer.</p>
        <Link href="/" className="btn-primary mt-6">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
