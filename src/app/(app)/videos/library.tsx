"use client";
import { useMemo, useOptimistic, useState } from "react";
import { ExternalLink, Heart, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import clsx from "clsx";
import type { Video } from "@/lib/schema";
import { WORKOUT_TYPES, typeInfo } from "@/lib/constants";
import { PLATFORM, youtubeId } from "@/lib/video";
import { deleteVideo, importVideoSelection, saveVideo, toggleFavorite } from "@/app/actions";
import { CHANNELS, THEME_TAGS } from "@/lib/video-catalog";
import { ConfirmButton, Form, SubmitButton } from "@/components/forms";
import { Sheet } from "@/components/sheet";

const SUGGESTED_TAGS = THEME_TAGS;

function VideoForm({ v, onDone }: { v?: Video; onDone: () => void }) {
  const [tags, setTags] = useState(v?.tags.join(", ") ?? "");
  const addTag = (t: string) => {
    const list = tags.split(",").map((x) => x.trim()).filter(Boolean);
    if (!list.includes(t)) setTags([...list, t].join(", "));
  };
  return (
    <Form action={saveVideo} success={v ? "Vidéo enregistrée" : "Vidéo ajoutée 🎬"} onDone={onDone} className="space-y-3">
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
            <button type="button" key={t} onClick={() => addTag(t)} className="chip transition active:scale-95">#{t}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input name="notes" defaultValue={v?.notes ?? ""} className="input" />
      </div>
      <SubmitButton className="btn-primary w-full">{v ? "Enregistrer" : "Ajouter la vidéo"}</SubmitButton>
    </Form>
  );
}

/** Sélection du coach : grande carte tant qu'elle n'est pas importée, simple bouton s'il manque des nouveautés. */
function SelectionBanner({ missing, total }: { missing: number; total: number }) {
  if (!missing) return null;
  const channels = Object.values(CHANNELS).map((c) => c.name).join(", ");
  if (missing < total)
    return (
      <Form action={importVideoSelection} success={`${missing} vidéo(s) ajoutée(s) 🎬`} className="mb-3">
        <SubmitButton className="chip text-accent transition active:scale-95" pendingLabel="Ajout…">
          <Sparkles size={12} /> Ajouter {missing} vidéo(s) de la sélection du coach
        </SubmitButton>
      </Form>
    );
  return (
    <section className="card mb-4 border-accent/40 bg-accent/5">
      <div className="flex items-start gap-3">
        <div className="text-3xl">🎬</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Sélection du coach · {total} séances guidées</h2>
          <p className="mt-1 text-sm text-ink-2">
            Des cours complets en studio ({channels}), rangés par thème : full body, haut du corps, jambes, HIIT, boxe, yoga, mobilité…
            Ton coach y pioche la vidéo qui colle au thème de ta séance.
          </p>
          <Form action={importVideoSelection} success="Sélection du coach ajoutée 🎬" className="mt-3">
            <SubmitButton className="btn-primary" pendingLabel="Ajout des vidéos…"><Plus size={16} /> Ajouter à ma vidéothèque</SubmitButton>
          </Form>
        </div>
      </div>
    </section>
  );
}

type SheetContent = { kind: "edit"; v?: Video } | { kind: "play"; v: Video };
type Change = { id: number; favorite?: boolean; deleted?: true };

export function VideoLibrary({ videos, initialTag, selection }: { videos: Video[]; initialTag: string | null; selection: { missing: number; total: number } }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(initialTag);
  const [favOnly, setFavOnly] = useState(false);
  // Feuille ouverte (édition ou lecture) : son contenu reste en place pendant l'animation de fermeture
  const [sheet, setSheet] = useState<SheetContent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (s: SheetContent) => {
    setSheet(s);
    setSheetOpen(true);
  };
  // Favori et suppression affichés tout de suite, sans attendre la réponse du serveur
  const [shown, applyChange] = useOptimistic(videos, (list, c: Change) =>
    c.deleted ? list.filter((v) => v.id !== c.id) : list.map((v) => (v.id === c.id ? { ...v, favorite: !!c.favorite } : v)),
  );

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of shown) for (const t of v.tags) m.set(t, (m.get(t) ?? 0) + 1);
    if (initialTag && !m.has(initialTag)) m.set(initialTag, 0); // filtre venu du coach (?tag=) : toujours visible
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [shown, initialTag]);

  const list = shown.filter(
    (v) =>
      (!tag || v.tags.includes(tag) || v.type === tag) &&
      (!favOnly || v.favorite) &&
      (!q || `${v.title} ${v.tags.join(" ")} ${v.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const resetFilters = () => {
    setQ("");
    setTag(null);
    setFavOnly(false);
  };

  return (
    <>
      <SelectionBanner {...selection} />
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" enterKeyHint="search" className="input pr-9 pl-9" />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Effacer la recherche"
              className="animate-pop absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-line text-ink-2"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => openSheet({ kind: "edit" })} className="btn-primary"><Plus size={16} /> <span className="hidden sm:inline">Ajouter</span></button>
      </div>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button onClick={() => { setTag(null); setFavOnly(false); }} className={clsx("chip shrink-0 transition active:scale-95", !tag && !favOnly && "border-accent text-accent")}>Toutes</button>
        <button onClick={() => setFavOnly((x) => !x)} className={clsx("chip shrink-0 transition active:scale-95", favOnly && "border-accent text-accent")}>♥ Favoris</button>
        {tagCounts.map(([t, n]) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)} className={clsx("chip shrink-0 transition active:scale-95", tag === t && "border-accent text-accent")}>
            #{t} <span className="text-muted">{n}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="animate-fade-up card py-12 text-center">
          <div className="text-5xl">🎬</div>
          <p className="mt-3 font-semibold">{shown.length ? "Aucun résultat" : "Ta vidéothèque est vide"}</p>
          <p className="mt-1 text-sm text-muted">
            {shown.length ? "Essaie un autre mot ou un autre filtre." : "Colle un lien YouTube, Instagram ou TikTok et range-le avec des tags."}
          </p>
          {shown.length > 0 && (
            <button type="button" onClick={resetFilters} className="btn-ghost mx-auto mt-4">Tout afficher</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => {
            const yt = youtubeId(v.url);
            const pf = PLATFORM[v.platform] ?? PLATFORM.web;
            return (
              <article key={v.id} className="animate-fade-up card overflow-hidden p-0">
                <button
                  onClick={() => (yt ? openSheet({ kind: "play", v }) : window.open(v.url, "_blank", "noopener"))}
                  aria-label={`Lire « ${v.title} »`}
                  className={clsx("group relative block aspect-video w-full overflow-hidden bg-gradient-to-br", pf.className)}
                >
                  {yt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-active:scale-[1.02]"
                    />
                  ) : (
                    <span className="text-4xl">{v.type ? typeInfo(v.type).emoji : "▶️"}</span>
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">{pf.label}</span>
                  {v.durationMin && <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">{v.durationMin}′</span>}
                </button>
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold">{v.title}</h3>
                      {v.notes && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{v.notes}</p>}
                    </div>
                    <form
                      action={async (f) => {
                        applyChange({ id: v.id, favorite: !v.favorite });
                        await toggleFavorite(f);
                      }}
                    >
                      <input type="hidden" name="id" value={v.id} />
                      <button aria-label={v.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={v.favorite} className="-m-1.5 p-1.5 transition active:scale-75">
                        <Heart key={String(v.favorite)} size={18} className={v.favorite ? "animate-pop fill-critical text-critical" : "text-muted"} />
                      </button>
                    </form>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.type && <span className="chip py-0.5">{typeInfo(v.type).emoji} {typeInfo(v.type).label}</span>}
                    {v.tags.map((t) => (
                      <button key={t} onClick={() => setTag(t)} className="chip py-0.5 transition active:scale-95">#{t}</button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn-ghost flex-1 py-2 text-xs"><ExternalLink size={14} /> Ouvrir</a>
                    <button onClick={() => openSheet({ kind: "edit", v })} className="btn-ghost py-2" aria-label="Modifier"><Pencil size={14} /></button>
                    <Form
                      action={async (f) => {
                        applyChange({ id: v.id, deleted: true });
                        await deleteVideo(f);
                      }}
                      success="Vidéo supprimée"
                    >
                      <input type="hidden" name="id" value={v.id} />
                      <ConfirmButton className="btn-ghost py-2 text-critical" aria-label="Supprimer"><Trash2 size={14} /></ConfirmButton>
                    </Form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheet?.kind === "play" ? sheet.v.title : sheet?.v ? "Modifier la vidéo" : "Nouvelle vidéo"}
      >
        {sheet?.kind === "edit" && <VideoForm key={sheet.v?.id ?? "new"} v={sheet.v} onDone={() => setSheetOpen(false)} />}
        {sheet?.kind === "play" && (
          <div className="mb-2 aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId(sheet.v.url)}?autoplay=1&playsinline=1`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
              title={sheet.v.title}
            />
          </div>
        )}
      </Sheet>
    </>
  );
}
