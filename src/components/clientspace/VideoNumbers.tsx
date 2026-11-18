import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readNumber } from "@/lib/contentMetrics";

type Row = { id: string; title: string; posted_at: string | null; platforms: string[] | null; metrics: Record<string, unknown> | null };
const SHOW = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
];
const fmt = (v: unknown) => { const n = readNumber(v == null ? null : String(v)); return n == null ? "–" : n.toLocaleString("en-GB"); };

/** Numbers for each video posted in a month, with each platform shown on its own. */
export default function VideoNumbers({ residentId, month }: { residentId: string; month: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    const s = new Date(month + "T00:00:00Z"); const e = new Date(s); e.setUTCMonth(e.getUTCMonth() + 1);
    supabase.from("content_items").select("id, title, posted_at, platforms, metrics")
      .eq("resident_id", residentId).is("cancelled_at", null)
      .gte("posted_at", s.toISOString()).lt("posted_at", e.toISOString()).order("posted_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [residentId, month]);

  if (!rows) return null;
  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="text-sm font-medium">Numbers for each video</div>
      <p className="text-xs text-ink-faint">Your Handler updates these as the numbers grow, so they can change during the month.</p>
      {rows.length === 0 ? <p className="mt-3 text-xs text-ink-faint">No videos posted this month yet.</p> : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            const m = r.metrics ?? {};
            const by = (m.by_platform ?? {}) as Record<string, Record<string, unknown>>;
            const plats = Object.keys(by).filter((p) => Object.values(by[p] ?? {}).some((v) => v !== "" && v != null));
            return (
              <li key={r.id} className="rounded-lg border border-hairline p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm">{r.title}</div>
                  <div className="text-xs text-ink-faint">{r.posted_at ? new Date(r.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}{r.platforms?.length ? ` · ${r.platforms.join(", ")}` : ""}</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {SHOW.map((f) => (
                    <div key={f.key}><div className="text-[11px] text-ink-faint">{f.label}</div><div className="text-sm font-semibold tabular-nums">{fmt(m[f.key])}</div></div>
                  ))}
                </div>
                {plats.length > 1 && (
                  <div className="mt-2 space-y-1 text-xs text-ink-soft">
                    {plats.map((p) => <div key={p}><span className="font-medium text-ink">{p}:</span> {SHOW.map((f) => `${f.label} ${fmt(by[p]?.[f.key])}`).join(", ")}</div>)}
                  </div>
                )}
                {!Object.keys(m).length && <p className="mt-1 text-xs text-ink-faint">Numbers not in yet.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
