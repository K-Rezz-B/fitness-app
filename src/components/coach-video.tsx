"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Play, Shuffle } from "lucide-react";
import { typeInfo } from "@/lib/constants";
import { youtubeId } from "@/lib/video";
import type { CoachVideoResult, VideoPick } from "@/lib/video-coach";

const tagHref = (t: string) => `/videos?tag=${encodeURIComponent(t)}`;

/**
 * Vidéo choisie par le coach pour la séance, parmi celles du même thème (tags).
 * « Une autre » passe à la suivante du classement ; `onPick` prévient le formulaire de séance.
 */
export function CoachVideo({ result, onPick }: { result: CoachVideoResult; onPick?: (p: VideoPick) => void }) {
  const { theme, picks, fromCatalog } = result;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  if (!picks.length)
    return (
      <div className="rounded-2xl border border-dashed border-line p-3 text-xs text-muted">
        🎬 Aucune vidéo <Link href={tagHref(theme[0])} className="text-accent">#{theme[0]}</Link> dans ta vidéothèque pour cette séance.
      </div>
    );

  const v = picks[i % picks.length];
  const yt = youtubeId(v.url);
  const next = () => {
    const n = picks[(i + 1) % picks.length];
    setI((x) => (x + 1) % picks.length);
    setPlaying(false);
    onPick?.(n);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">🎬 Vidéo choisie par ton coach</span>
        {picks.length > 1 && (
          <button type="button" onClick={next} className="chip shrink-0 text-accent">
            <Shuffle size={12} /> Une autre <span className="text-muted">{(i % picks.length) + 1}/{picks.length}</span>
          </button>
        )}
      </div>

      {playing && yt ? (
        <div className="aspect-video overflow-hidden rounded-xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full"
            title={v.title}
          />
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => (yt ? setPlaying(true) : window.open(v.url, "_blank", "noopener"))}
            className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black sm:w-40"
            aria-label={`Lancer ${v.title}`}
          >
            {yt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-3xl">{v.type ? typeInfo(v.type).emoji : "▶️"}</span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/20">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-black/60"><Play size={16} className="ml-0.5 fill-white text-white" /></span>
            </span>
            {v.durationMin && <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[10px]">{v.durationMin}′</span>}
          </button>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm font-semibold">{v.title}</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted">{[v.notes, v.durationMin && `${v.durationMin} min`].filter(Boolean).join(" · ")}</div>
            <div className="mt-1 text-xs text-ink-2">{v.cooldown ? "Retour au calme, à faire après ta séance" : "À suivre pendant la séance"}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {v.matched.map((t) => (
                <Link key={t} href={tagHref(t)} className="chip py-0.5 text-[11px]">#{t}</Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {fromCatalog && v.id === null ? (
            <>Tirée de la sélection du coach · <Link href="/videos" className="text-accent">l&apos;ajouter à ta vidéothèque</Link></>
          ) : (
            <>Thème : {theme.map((t) => `#${t}`).join(" ")}</>
          )}
        </span>
        <a href={v.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-ink-2">
          <ExternalLink size={12} /> YouTube
        </a>
      </div>
    </div>
  );
}
