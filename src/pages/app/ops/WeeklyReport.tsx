import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { Metric, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { field, niceDate, solidBtn, ghostBtn, weekStartISO } from "@/lib/legal";

type Report = {
  id: string;
  week_start: string;
  body: string | null;
  metrics: Record<string, number>;
  published: boolean;
};

export default function WeeklyReport() {
  const { isLeadership } = useMyRoles();
  const [week, setWeek] = useState(weekStartISO());
  const [report, setReport] = useState<Report | null>(null);
  const [past, setPast] = useState<Report[]>([]);
  const [body, setBody] = useState("");
  const [numbers, setNumbers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, list] = await Promise.all([
      supabase.from("weekly_reports").select("*").eq("week_start", week).maybeSingle(),
      supabase.from("weekly_reports").select("*").order("week_start", { ascending: false }).limit(12),
    ]);
    const row = (r.data as Report | null) ?? null;
    setReport(row);
    setBody(row?.body ?? "");
    setPast((list.data as Report[]) ?? []);
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const end = new Date(`${week}T00:00:00`);
      end.setDate(end.getDate() + 7);
      const endISO = end.toISOString().slice(0, 10);
      const [content, shoots, posted] = await Promise.all([
        supabase.from("content_items").select("id", { count: "exact", head: true }).gte("added_on", week).lt("added_on", endISO),
        supabase.from("shoot_days").select("id", { count: "exact", head: true }).gte("shoot_date", week).lt("shoot_date", endISO),
        supabase.from("content_items").select("id", { count: "exact", head: true }).gte("posted_at", week).lt("posted_at", endISO),
      ]);
      setNumbers({
        ideas_added: content.count ?? 0,
        shoot_days: shoots.count ?? 0,
        posted: posted.count ?? 0,
      });
    })();
  }, [week]);

  const save = async (publish: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("weekly_reports")
      .upsert({ week_start: week, body, metrics: numbers, published: publish }, { onConflict: "week_start" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Report published." : "Saved.");
    load();
  };

  return (
    <SectionPage
      eyebrow="Management"
      title="Weekly report."
      lede="The week's numbers pulled automatically, with room for the written note."
      path="/app/ops/report"
      actions={
        <input
          type="date"
          aria-label="Week beginning"
          className="press rounded-full border border-rule bg-paper-raised px-4 py-2 text-sm focus-ring"
          value={week}
          onChange={(e) => setWeek(weekStartISO(new Date(e.target.value || Date.now())))}
        />
      }
    >
      <SectionHeading index="01" title={`Week of ${niceDate(week)}`} hint={report?.published ? "Published" : "Draft"} />
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <Metric label="Ideas added" value={numbers.ideas_added ?? 0} />
        <Metric label="Shoot days" value={numbers.shoot_days ?? 0} />
        <Metric label="Posted" value={numbers.posted ?? 0} tone="signal" />
      </div>

      <SectionHeading index="02" title="The note" hint={isLeadership ? "Leadership writes this" : "Read only"} />
      {isLeadership ? (
        <>
          <textarea
            rows={8}
            className={field}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What went well, what slipped, what next week needs."
          />
          <div className="mt-4 flex gap-2">
            <button className={ghostBtn} disabled={busy} onClick={() => save(false)}>
              Save draft
            </button>
            <button className={solidBtn} disabled={busy} onClick={() => save(true)}>
              Publish to the team
            </button>
          </div>
        </>
      ) : (
        <div className="surface rounded-xl p-5 text-sm whitespace-pre-wrap">
          {report?.published ? report.body || "No note written." : "This week's report is not out yet."}
        </div>
      )}

      <SectionHeading index="03" title="Earlier weeks" hint="Last twelve" className="mt-10" />
      {!past.length ? (
        <div className="surface rounded-xl p-8 text-sm text-ink-soft">No reports written yet.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {past.map((p) => (
            <li key={p.id} className="px-5 py-4 flex items-center gap-3">
              <button className="text-sm font-semibold hover:text-signal" onClick={() => setWeek(p.week_start)}>
                Week of {niceDate(p.week_start)}
              </button>
              <span className="flex-1" />
              <StatusChip value={p.published ? "published" : "draft"} tone={p.published ? "teal" : "neutral"} />
            </li>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}
