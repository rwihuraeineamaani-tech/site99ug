import { METRIC_FIELDS } from "./contentFlow";

/** One platform's numbers, keyed by METRIC_FIELDS key. */
export type PlatformNumbers = Record<string, string>;
export type ByPlatform = Record<string, PlatformNumbers>;

/** Numbers that add up across platforms (watch time is an average, so it is never summed). */
const SUMMED = ["views", "reach", "likes", "comments", "shares", "saves", "follows", "link_clicks"];

const ALIASES: Record<string, string> = {
  ig: "Instagram", insta: "Instagram", instagram: "Instagram",
  tt: "TikTok", tiktok: "TikTok",
  yt: "YouTube", youtube: "YouTube",
  fb: "Facebook", facebook: "Facebook",
  li: "LinkedIn", linkedin: "LinkedIn",
  wa: "WhatsApp", whatsapp: "WhatsApp",
  x: "X",
};

/** Reads "11.6K", "1,094", "1,4k" or "5.7s" as a number. Returns null for blanks and dashes. */
export const readNumber = (raw: string | null | undefined): number | null => {
  let v = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!v || v === "-") return null;
  v = v.replace(/s$/, "");
  let mult = 1;
  if (v.endsWith("k")) { mult = 1_000; v = v.slice(0, -1); }
  else if (v.endsWith("m")) { mult = 1_000_000; v = v.slice(0, -1); }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, "");
  else v = v.replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * mult * 100) / 100 : null;
};

/** Splits an old combined entry like "IG,65 TT, 859" or "IG:20s, TT:15.6s" by platform. */
export const splitCombined = (raw: string): Record<string, string> | null => {
  const out: Record<string, string> = {};
  const re = /\b(instagram|insta|ig|tiktok|tt|youtube|yt|facebook|fb|linkedin|li|whatsapp|wa|x)\b\s*[,:]?\s*(\d[\d.,]*\s*[km]?s?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = ALIASES[m[1].toLowerCase()];
    if (name) out[name] = m[2].trim().replace(/[.,]+$/, "");
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Turns whatever is saved on a video into one set of numbers per platform.
 * New saves carry `by_platform`. Older saves had one box per number, sometimes
 * with "IG,.. TT,.." typed inside: those are split, and a single-platform video
 * keeps its numbers under that platform.
 */
export const toByPlatform = (metrics: Record<string, unknown> | null | undefined, platforms: string[]): ByPlatform => {
  const out: ByPlatform = {};
  platforms.forEach((p) => (out[p] = {}));
  const m = (metrics ?? {}) as Record<string, unknown>;
  const saved = m.by_platform as ByPlatform | undefined;
  if (saved && typeof saved === "object") {
    Object.entries(saved).forEach(([p, v]) => (out[p] = { ...(v ?? {}) }));
    return out;
  }
  METRIC_FIELDS.forEach(({ key }) => {
    const raw = String(m[key] ?? "").trim();
    if (!raw) return;
    const split = splitCombined(raw);
    if (split) {
      Object.entries(split).forEach(([p, v]) => {
        out[p] = out[p] ?? {};
        out[p][key] = v;
      });
    } else if (platforms.length === 1) {
      out[platforms[0]][key] = raw;
    }
  });
  return out;
};

/** Values the platforms could not be told apart for (older combined entries on multi-platform videos). */
export const unsplitLegacy = (metrics: Record<string, unknown> | null | undefined, platforms: string[]): Record<string, string> => {
  const m = (metrics ?? {}) as Record<string, unknown>;
  if (m.by_platform || platforms.length === 1) return {};
  const out: Record<string, string> = {};
  METRIC_FIELDS.forEach(({ key }) => {
    const raw = String(m[key] ?? "").trim();
    if (raw && raw !== "-" && !splitCombined(raw)) out[key] = raw;
  });
  return out;
};

/** Adds platform numbers into one total per metric (watch time is left out). */
export const totals = (by: ByPlatform): Record<string, string> => {
  const out: Record<string, string> = {};
  SUMMED.forEach((key) => {
    let sum = 0;
    let any = false;
    Object.values(by).forEach((p) => {
      const n = readNumber(p?.[key]);
      if (n !== null) { sum += n; any = true; }
    });
    if (any) out[key] = String(sum);
  });
  return out;
};

/** What gets saved: per-platform numbers, the totals for older screens, and the note. */
export const buildMetrics = (by: ByPlatform, note: string) => {
  const clean: ByPlatform = {};
  Object.entries(by).forEach(([p, v]) => {
    const filled = Object.fromEntries(Object.entries(v ?? {}).filter(([, x]) => String(x ?? "").trim()));
    if (Object.keys(filled).length) clean[p] = filled;
  });
  return { ...totals(clean), by_platform: clean, note };
};

/** Flat "TikTok views: 1094" style list for the AI recommendations. */
export const flatForAi = (by: ByPlatform): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.entries(by).forEach(([p, v]) =>
    METRIC_FIELDS.forEach(({ key, label }) => {
      const x = String(v?.[key] ?? "").trim();
      if (x) out[`${p} ${label}`] = x;
    }),
  );
  return out;
};

export const filledCount = (n: PlatformNumbers | undefined) =>
  METRIC_FIELDS.filter(({ key }) => String(n?.[key] ?? "").trim()).length;
