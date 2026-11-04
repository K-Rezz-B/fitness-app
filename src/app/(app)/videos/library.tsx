"use client";
import { useMemo, useState } from "react";
import { ExternalLink, Heart, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import clsx from "clsx";
import type { Video } from "@/lib/schema";
import { WORKOUT_TYPES, typeInfo } from "@/lib/constants";
import { PLATFORM, youtubeId } from "@/lib/video";
import { deleteVideo, saveVideo, toggleFavorite } from "@/app/actions";

const SUGGESTED_TAGS = ["abdos", "full body", "haut du corps", "jambes", "fessiers", "dos", "cardio", "hiit", "mobilité", "étirements", "sans matériel", "haltères", "débutant", "échauffement", "récup"];

function VideoForm({ v, onDone }: { v?: Video; onDone: () => void }) {
  const [tags, setTags] = useState(v?.tags.join(", ") ?? "");
  const addTag = (t: string) => {
    const list = tags.split(",").map((x) => x.trim()).filter(Boolean);
    if (!list.includes(t)) setTags([...list, t].join(", "));
  };
  return (
    <form
      action={async (f) => {
        await saveVideo(f);
        onDone();
      }}
      className="space-y-3"
    >
      {v && <input type="hidden" name="id" value={v.id} />}
      <div>
        <label className="label">Lien (YouTube, Instagram, TikTok…)</label>
        <input name="url" type="url" required defaultValue={v?.url} placeholder="https://youtu.be/…" className="input" />
      </div>
      <div>
        <label className="label">Titre</label>
        <input name="title" defaultValue={v?.title} placeholder="Ex : 20 min abdos sans matériel" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select name="type" defaultValue={v?.type ?? ""} className="input">
            <option value="">—</option>
            {WORKOUT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Durée (min)</label>
          <input name="durationMin" type="number" inputMode="numeric" defaultValue={v?.durationMin ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Tags (séparés par des virgules)</label>
        <input name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="abdos, sans matériel" className="input" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.map((t) => (
            <button type="button" key={t} onClick={() => addTag(t)} className="chip">#{t}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input name="notes" defaultValue={v?.notes ?? ""} className="input" />
      </div>
      <button className="btn-primary w-full">{v ? "Enregistrer" : "Ajouter la vidéo"}</button>
    </form>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="pb-safe max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-muted"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function VideoLibrary({ videos }: { videos: Video[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [editing, setEditing] = useState<Video | "new" | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of videos) for (const t of v.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [videos]);

  const list = videos.filter(
    (v) =>
      (!tag || v.tags.includes(tag) || v.type === tag) &&
      (!favOnly || v.favorite) &&
      (!q || `${v.title} ${v.tags.join(" ")} ${v.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary"><Plus size={16} /> <span className="hidden sm:inline">Ajouter</span></button>
      </div>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button onClick={() => { setTag(null); setFavOnly(false); }} className={clsx("chip shrink-0", !tag && !favOnly && "border-accent text-accent")}>Toutes</button>
        <button onClick={() => setFavOnly((x) => !x)} className={clsx("chip shrink-0", favOnly && "border-accent text-accent")}>♥ Favoris</button>
        {tagCounts.map(([t, n]) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)} className={clsx("chip shrink-0", tag === t && "border-accent text-accent")}>
            #{t} <span className="text-muted">{n}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="text-5xl">🎬</div>
          <p className="mt-3 font-semibold">{videos.length ? "Aucun résultat" : "Ta vidéothèque est vide"}</p>
          <p className="mt-1 text-sm text-muted">Colle un lien YouTube, Instagram ou TikTok et range-le avec des tags.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => {
            const yt = youtubeId(v.url);
            const pf = PLATFORM[v.platform] ?? PLATFORM.web;
            return (
              <article key={v.id} className="card overflow-hidden p-0">
                <button
                  onClick={() => (yt ? setPlaying(v) : window.open(v.url, "_blank", "noopener"))}
                  className={clsx("relative block aspect-video w-full bg-gradient-to-br", pf.className)}
                >
                  {yt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-4xl">{v.type ? typeInfo(v.type).emoji : "▶️"}</span>
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">{pf.label}</span>
                  {v.durationMin && <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">{v.durationMin}′</span>}
                </button>
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <h3 className="line-clamp-2 flex-1 text-sm font-semibold">{v.title}</h3>
                    <form action={toggleFavorite}>
                      <input type="hidden" name="id" value={v.id} />
                      <button aria-label="Favori"><Heart size={18} className={v.favorite ? "fill-critical text-critical" : "text-muted"} /></button>
                    </form>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.type && <span className="chip py-0.5">{typeInfo(v.type).emoji} {typeInfo(v.type).label}</span>}
                    {v.tags.map((t) => (
                      <button key={t} onClick={() => setTag(t)} className="chip py-0.5">#{t}</button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn-ghost flex-1 py-2 text-xs"><ExternalLink size={14} /> Ouvrir</a>
                    <button onClick={() => setEditing(v)} className="btn-ghost py-2" aria-label="Modifier"><Pencil size={14} /></button>
                    <form action={deleteVideo} onSubmit={(e) => { if (!confirm("Supprimer cette vidéo ?")) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={v.id} />
                      <button className="btn-ghost py-2 text-critical" aria-label="Supprimer"><Trash2 size={14} /></button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <Sheet title={editing === "new" ? "Nouvelle vidéo" : "Modifier la vidéo"} onClose={() => setEditing(null)}>
          <VideoForm v={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
        </Sheet>
      )}
      {playing && (
        <Sheet title={playing.title} onClose={() => setPlaying(null)}>
          <div className="aspect-video overflow-hidden rounded-2xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId(playing.url)}?autoplay=1&playsinline=1`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
              title={playing.title}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}
