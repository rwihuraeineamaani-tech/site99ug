import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { StatusChip, FilterBar, SelectFilter } from "@/components/system";
import { daysUntil, dueLabel, dueTone, niceDate } from "@/lib/legal";

type Row = { key: string; date: string; what: string; kind: string; to?: string };

export default function Deadlines() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [content, days, contracts, compliance] = await Promise.all([
        supabase.from("content_items").select("id, ref_no, title, stage, shoot_at, metrics_due_at, metrics_filled_at"),
        supabase.from("shoot_days").select("id, shoot_date, status, location"),
        supabase.from("contracts").select("id, title, party_name, ends_on, status"),
        supabase.from("compliance_items").select("id, name, renews_on, status"),
      ]);

      const out: Row[] = [];
      for (const c of (content.data ?? []) as {
        id: string;
        ref_no: number;
        title: string;
        stage: string;
        shoot_at: string | null;
        metrics_due_at: string | null;
        metrics_filled_at: string | null;
      }[]) {
        if (c.shoot_at && !["Posted", "Archived"].includes(c.stage))
          out.push({ key: `s${c.id}`, date: c.shoot_at, what: `Shoot — ${c.title}`, kind: "Content", to: `/app/content?ref=${c.ref_no}` });
        if (c.metrics_due_at && !c.metrics_filled_at)
          out.push({ key: `m${c.id}`, date: c.metrics_due_at, what: `Numbers due — ${c.title}`, kind: "Content", to: `/app/content?ref=${c.ref_no}` });
      }
      for (const d of (days.data ?? []) as { id: string; shoot_date: string | null; status: string; location: string | null }[]) {
        if (d.shoot_date && d.status !== "wrapped")
          out.push({ key: `d${d.id}`, date: d.shoot_date, what: `Shoot day — ${d.location || "location to confirm"}`, kind: "Shoot", to: "/app/shoots" });
      }
      for (const c of (contracts.data ?? []) as { id: string; title: string; party_name: string; ends_on: string | null; status: string }[]) {
        if (c.ends_on && !["ended", "cancelled"].includes(c.status))
          out.push({ key: `c${c.id}`, date: c.ends_on, what: `Contract ends — ${c.title} (${c.party_name})`, kind: "Legal", to: "/app/legal/contracts" });
      }
      for (const c of (compliance.data ?? []) as { id: string; name: string; renews_on: string | null; status: string }[]) {
        if (c.renews_on && c.status !== "retired")
          out.push({ key: `o${c.id}`, date: c.renews_on, what: `Renewal — ${c.name}`, kind: "Legal", to: "/app/legal/compliance" });
      }
      out.sort((a, b) => a.date.localeCompare(b.date));
      setRows(out);
      setLoading(false);
    })();
  }, []);

  const shown = useMemo(() => rows.filter((r) => kind === "all" || r.kind === kind), [rows, kind]);
  const late = rows.filter((r) => (daysUntil(r.date) ?? 0) < 0).length;

  return (
    <SectionPage
      eyebrow="Management"
      title="Deadlines."
      lede={`Everything with a date on it, soonest first. ${late} item${late === 1 ? " is" : "s are"} already late.`}
      path="/app/ops/deadlines"
    >
      <FilterBar>
        <SelectFilter
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "Everything" },
            { value: "Content", label: "Content" },
            { value: "Shoot", label: "Shoots" },
            { value: "Legal", label: "Legal" },
          ]}
        />
      </FilterBar>

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : !shown.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">Nothing with a date attached.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {shown.map((r) => (
            <li key={r.key} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <span className="text-xs text-ink-soft w-32">{niceDate(r.date)}</span>
              <StatusChip value={dueLabel(r.date)} tone={dueTone(r.date)} />
              <span className="flex-1 min-w-[12rem] text-sm">{r.what}</span>
              <StatusChip value={r.kind} tone="violet" />
              {r.to && (
                <Link to={r.to} className="text-xs text-signal font-semibold">
                  Open →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}
