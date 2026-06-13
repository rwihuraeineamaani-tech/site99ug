export function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch { /* noop */ }
  const m = String(url).match(/[?&]v=([^&#]+)/);
  return m ? m[1] : null;
}

export function youtubeBgEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&vq=hd1080`;
}

export function youtubePlayerEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&vq=hd1080`;
}

export function youtubeThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

export const ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16", "3:2", "2:3"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export function aspectRatioClass(ratio?: string | null): string {
  switch (ratio) {
    case "1:1": return "aspect-square";
    case "16:9": return "aspect-[16/9]";
    case "9:16": return "aspect-[9/16]";
    case "3:2": return "aspect-[3/2]";
    case "2:3": return "aspect-[2/3]";
    case "4:5":
    default: return "aspect-[4/5]";
  }
}
