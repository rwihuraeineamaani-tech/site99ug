import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readNumber } from "@/lib/contentMetrics";
import { KIND_LABEL, contentKind, metricFieldsFor, type ContentKind } from "@/lib/contentFlow";

type Row = { id: string; title: string; content_type: string | null; posted_at: string | null; platforms: string[] | null; metrics: Record<string, unknown> | null };
const fmt = (v: unknown) => { const n = readNumber(v == null ? null : String(v)); return n == null ? "–" : n.toLocaleString("en-GB"); };
const show = (type: string | null) => metricFieldsFor(type).filter((f) => f.key !== "avg_watch_time" && f.key !== "link_clicks");

/** Numbers for each post in a month, grouped into videos and photo posts, each with its own fields. */
export default function VideoNumbers({ residentId, month }: { residentId: string; month: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    const s = new Date(month + "T00:00:00Z"); const e = new Date(s); e.setUTCMonth(e.getUTCMonth() + 1);
    supabase.from("content_items").select("id, title, content_type, posted_at, platforms, metrics")
      .eq("resident_id", residentId).is("cancelled_at", null)
      .gte("posted_at", s.toISOString()).lt("posted_at", e.toISOString()).order("posted_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [residentId, month]);

  if (!rows) return null;
  return (
    <div className="space-y-4">
      {(["video", "photo"] as ContentKind[]).map((kind) => {
        const list = rows.filter((r) => contentKind(r.content_type) === kind);
        const fields = show(kind === "video" ? "video" : "photo");
        const total = (key: string) => list.reduce((t, r) => t + (readNumber(String((r.metrics ?? {})[key] ?? "")) ?? 0), 0);
        return (
          <div key={kind} className="rounded-xl border border-hairline p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-medium">{KIND_LABEL[kind]} · {list.length}</div>
              <div className="text-xs text-ink-faint">Your Handler updates these as the numbers grow.</div>
            </div>
            {list.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-paper-sunken p-2 sm:grid-cols-4 lg:grid-cols-8">
                {fields.map((f) => <div key={f.key}><div className="text-[11px] text-ink-faint">Total {f.label.toLowerCase()}</div><div className="text-sm font-semibold tabular-nums">{total(f.key).toLocaleString("en-GB")}</div></div>)}
              </div>
            )}
            {list.length === 0 ? <p className="mt-2 text-xs text-ink-faint">No {KIND_LABEL[kind].toLowerCase()} posted this month yet.</p> : (
              <ul className="mt-3 space-y-2">
                {list.map((r) => {
                  const m = r.metrics ?? {};
                  const by = (m.by_platform ?? {}) as Record<string, Record<string, unknown>>;
                  const plats = Object.keys(by).filter((p) => Object.values(by[p] ?? {}).some((v) => v !== "" && v != null));
                  const f = show(r.content_type);
                  return (
                    <li key={r.id} className="rounded-lg border border-hairline p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm">{r.title}</div>
                        <div className="text-xs text-ink-faint">{r.content_type ? `${r.content_type} · ` : ""}{r.posted_at ? new Date(r.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}{r.platforms?.length ? ` · ${r.platforms.join(", ")}` : ""}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        {f.map((x) => <div key={x.key}><div className="text-[11px] text-ink-faint">{x.label}</div><div className="text-sm font-semibold tabular-nums">{fmt(m[x.key])}</div></div>)}
                      </div>
                      {plats.length > 1 && (
                        <div className="mt-2 space-y-1 text-xs text-ink-soft">
                          {plats.map((p) => <div key={p}><span className="font-medium text-ink">{p}:</span> {f.map((x) => `${x.label} ${fmt(by[p]?.[x.key])}`).join(", ")}</div>)}
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
      })}
    </div>
  );
}
