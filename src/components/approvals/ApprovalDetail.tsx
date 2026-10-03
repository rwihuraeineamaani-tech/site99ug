import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/components/system";

/** Everything we know about the record behind an approval, in plain words, so nobody signs blind. */
const HIDE = new Set(["id", "created_by", "updated_by", "transaction_id", "transfer_group_id", "workflow_version_id", "recur_parent_id", "sort"]);
const pretty = (k: string) =>
  k.replace(/_ugx$/, "").replace(/_id$/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function show(k: string, v: unknown, people: Record<string, string>, clients: Record<string, string>): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (k.endsWith("_ugx") || k === "amount") return formatUGX(Number(v));
  if (k === "resident_id") return clients[String(v)] ?? "Client";
  if (/(_by|requester|requester_id|user_id|actor_id)$/.test(k)) return people[String(v)] ?? "Team member";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== "" && x != null);
    return entries.length ? entries.map(([a, b]) => `${pretty(a)}: ${typeof b === "object" ? JSON.stringify(b) : b}`).join(" · ") : null;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (k === "vat_mode") return ({ inclusive: "VAT included", exclusive: "VAT added on top", exempt: "No VAT", unknown: "Not confirmed" } as Record<string, string>)[s] ?? s;
  return s;
}

export default function ApprovalDetail({ entity }: { entity: { table: string; id: string; instanceId?: string } }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<{ actor_id: string; decision: string; note: string | null; created_at: string }[]>([]);
  const [files, setFiles] = useState<{ label: string; url: string }[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [r, team, res, dec, inst] = await Promise.all([
        entity.id ? db.from(entity.table).select("*").eq("id", entity.id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("team_members").select("user_id, display_name, email"),
        supabase.from("residents").select("id, name"),
        entity.instanceId ? db.from("approval_decisions").select("actor_id, decision, note, created_at").eq("instance_id", entity.instanceId).order("created_at") : Promise.resolve({ data: [] }),
        entity.instanceId ? db.from("approval_instances").select("detail, amount, requester_id, created_at, context").eq("id", entity.instanceId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (off) return;
      const data = { ...((inst?.data as Record<string, unknown>) ?? {}), ...((r?.data as Record<string, unknown>) ?? {}) };
      setRow(Object.keys(data).length ? data : null);
      setHistory(dec?.data ?? []);
      setPeople(Object.fromEntries(((team.data ?? []) as { user_id: string; display_name: string | null; email: string | null }[]).map((p) => [p.user_id, p.display_name || p.email || "Team member"])));
      setClients(Object.fromEntries(((res.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])));
      // Attached evidence or signed copies.
      const paths: { label: string; path: string; bucket: string }[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === "string" && v && /(attachment|file|evidence|receipt)_?(path|url)?$/.test(k)) {
          paths.push({ label: pretty(k), path: v, bucket: entity.table === "resident_contracts" ? "contracts" : "finance" });
        }
      }
      const out: { label: string; url: string }[] = [];
      for (const p of paths) {
        if (p.path.startsWith("http")) { out.push({ label: p.label, url: p.path }); continue; }
        const { data: s } = await supabase.storage.from(p.bucket).createSignedUrl(p.path, 600);
        if (s?.signedUrl) out.push({ label: p.label, url: s.signedUrl });
      }
      if (!off) { setFiles(out); setLoading(false); }
    })().catch(() => !off && setLoading(false));
    return () => { off = true; };
  }, [entity.table, entity.id, entity.instanceId]);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-rule/30" />;
  if (!row) return <p className="text-sm text-ink-soft">The full record could not be loaded, it may be restricted or deleted. Use Open to view it.</p>;

  const fields = Object.entries(row)
    .filter(([k]) => !HIDE.has(k) && !/(path|url)$/.test(k))
    .map(([k, v]) => [pretty(k), show(k, v, people, clients)] as const)
    .filter(([, v]) => v !== null);

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {fields.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-rule py-1.5">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="press focus-ring rounded-full border border-rule px-3 py-1 text-xs">
              View {f.label.toLowerCase()}
            </a>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div>
          <p className="eyebrow text-[10px] text-ink-faint">Sign-off trail</p>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="text-ink-soft">
                {people[h.actor_id] ?? "Someone"} {h.decision.replace(/_/g, " ")} on {new Date(h.created_at).toLocaleDateString("en-GB")}
                {h.note ? `. "${h.note}"` : "."}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
