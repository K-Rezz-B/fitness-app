export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/vimeo\.com/.test(u)) return "vimeo";
  return "web";
}

export function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) ?? null;
  return m ? m[1] : null;
}

export const PLATFORM: Record<string, { label: string; className: string }> = {
  youtube: { label: "YouTube", className: "from-red-600/70 to-red-900/70" },
  instagram: { label: "Instagram", className: "from-fuchsia-600/70 to-amber-500/70" },
  tiktok: { label: "TikTok", className: "from-cyan-500/60 to-pink-600/60" },
  vimeo: { label: "Vimeo", className: "from-sky-500/70 to-sky-900/70" },
  web: { label: "Lien", className: "from-zinc-600/70 to-zinc-900/70" },
};
