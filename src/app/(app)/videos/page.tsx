import type { Metadata } from "next";
import { getVideos } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { VideoLibrary } from "./library";

export const metadata: Metadata = { title: "Vidéos" };

export default async function Videos() {
  const videos = await getVideos();
  return (
    <>
      <PageHeader title="Vidéos" subtitle={`${videos.length} vidéo(s) d'entraînement`} />
      <VideoLibrary videos={videos} />
    </>
  );
}
