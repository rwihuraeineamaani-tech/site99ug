/** Posted links are stored as "Platform: url". Returns the platform and a clickable url. */
export function parsePostLink(row: string): { platform: string; url: string } {
  const at = row.indexOf(": ");
  if (at > 0 && !row.slice(0, at).includes("/")) return { platform: row.slice(0, at).trim(), url: row.slice(at + 2).trim() };
  const url = row.trim();
  return { platform: guessPlatform(url), url };
}

export function guessPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram")) return "Instagram";
  if (u.includes("tiktok")) return "TikTok";
  if (u.includes("youtu")) return "YouTube";
  if (u.includes("facebook") || u.includes("fb.watch")) return "Facebook";
  if (u.includes("x.com") || u.includes("twitter")) return "X";
  if (u.includes("linkedin")) return "LinkedIn";
  return "the post";
}

/** "Instagram, TikTok and YouTube" */
export function platformList(platforms: string[] | null | undefined): string {
  const p = (platforms ?? []).filter(Boolean);
  if (!p.length) return "";
  if (p.length === 1) return p[0];
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}

/** Label for the Google Drive cut link, naming where it will be posted. */
export function cutLabel(platforms: string[] | null | undefined): string {
  const p = platformList(platforms);
  return p ? `Watch the ${p} cut (Google Drive)` : "Watch the cut (Google Drive)";
}
