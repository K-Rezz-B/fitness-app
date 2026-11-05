import type { Metadata } from "next";
import { getVideos } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { youtubeId } from "@/lib/video";
import { VIDEO_CATALOG } from "@/lib/video-catalog";
import { PageHeader } from "@/components/ui";
import { VideoLibrary } from "./library";

export const metadata: Metadata = { title: "Vidéos" };

export default async function Videos({ searchParams }: PageProps<"/videos">) {
  const [videos, sp] = await Promise.all([getVideos((await requireProfile()).id), searchParams]);
  const tag = typeof sp.tag === "string" ? sp.tag.trim().toLowerCase() || null : null;
  // Vidéos de la sélection du coach pas encore dans la vidéothèque
  const have = new Set(videos.map((v) => youtubeId(v.url)));
  const missing = VIDEO_CATALOG.filter((c) => !have.has(c.yt)).length;
  return (
    <>
      <PageHeader title="Vidéos" subtitle={`${videos.length} vidéo(s) d'entraînement`} />
      <VideoLibrary key={tag ?? ""} videos={videos} initialTag={tag} selection={{ missing, total: VIDEO_CATALOG.length }} />
    </>
  );
}
