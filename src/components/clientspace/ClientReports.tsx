import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MonthResults from "@/components/clientspace/MonthResults";
import { downloadMonthPdf, monthLabel, monthStart, openStorageFile, type MonthMetrics } from "@/lib/clientMonth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Report = { id: string; month: string; summary: string | null; file_path: string | null; file_name: string | null; published: boolean };

/** Monthly results: uploaded report plus live system numbers. Staff can upload and publish; clients only see published months. */
export default function ClientReports({ residentId, clientName, staff = false }: { residentId: string; clientName: string; staff?: boolean }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [month, setMonth] = useState(monthStart(new Date()));
  const [nums, setNums] = useState<{ m: MonthMetrics; b: MonthMetrics | null } | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await db.from("client_reports").select("*").eq("resident_id", residentId).order("month", { ascending: false });
    setReports(data ?? []);
  };
  useEffect(() => { load(); }, [residentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = staff
    ? Array.from(new Set([monthStart(new Date()), ...reports.map((r) => r.month)])).sort().reverse()
    : reports.map((r) => r.month);
  useEffect(() => { if (!staff && months.length && !months.includes(month)) setMonth(months[0]); }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = reports.find((r) => r.month === month) ?? null;
  useEffect(() => { setSummary(current?.summary ?? ""); setNums(null); }, [month, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: Partial<Report>, file?: File) => {
    setBusy(true);
    try {
      let file_path = current?.file_path ?? null; let file_name = current?.file_name ?? null;
      if (file) {
        file_path = `${residentId}/reports/${month.slice(0, 7)}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("resident-files").upload(file_path, file);
        if (up.error) throw up.error;
        file_name = file.name;
      }
      const row = { resident_id: residentId, month, summary: summary || null, file_path, file_name, published: current?.published ?? false, ...patch };
      const { error } = await db.from("client_reports").upsert(row, { onConflict: "resident_id,month" });
      if (error) throw error;
      toast.success(patch.published ? "Report published. The client has been notified." : "Report saved.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };

  if (!staff && !reports.length) return <p className="text-sm text-ink-faint">Your first monthly report will appear here once your Handler publishes it.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {staff && <input type="month" className="ctl rounded-full px-3 py-1.5 text-sm" value={month.slice(0, 7)} onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)} />}
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {months.map((mo) => {
            const r = reports.find((x) => x.month === mo);
            return (
              <button key={mo} onClick={() => setMonth(mo)} className={`press shrink-0 rounded-full px-3 py-1.5 text-xs ${mo === month ? "bg-paper-raised text-ink" : "text-ink-soft"}`}>
                {monthLabel(mo)}{staff && r ? (r.published ? " · published" : " · draft") : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{monthLabel(month)}</div>
            {!staff && current?.summary && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-ink-soft">{current.summary}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {current?.file_path && (
              <Button size="sm" variant="outline" onClick={() => openStorageFile(current.file_path!, current.file_name ?? undefined).catch((e) => toast.error(e.message))}>
                <FileText className="h-4 w-4" /> {staff ? current.file_name ?? "Report file" : "Download report"}
              </Button>
            )}
            <Button size="sm" disabled={!nums} onClick={() => nums && downloadMonthPdf(clientName, month, nums.m, nums.b, current?.summary)}>
              <Download className="h-4 w-4" /> Numbers PDF
            </Button>
          </div>
        </div>

        {staff && (
          <div className="mt-4 space-y-3 rounded-xl border border-hairline p-3">
            <textarea className="ctl w-full rounded-xl p-3 text-sm" rows={3} placeholder="Short summary for the client: what worked, what's next." value={summary} onChange={(e) => setSummary(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="ctl press inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                <Upload className="h-4 w-4" /> {current?.file_path ? "Replace report file" : "Upload report file"}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={(e) => { const f = e.target.files?.[0]; if (f) save({}, f); e.target.value = ""; }} />
              </label>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => save({})}>Save draft</Button>
              {current?.published
                ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ published: false })}>Unpublish</Button>
                : <Button size="sm" disabled={busy} onClick={() => save({ published: true })}>Publish to client</Button>}
            </div>
          </div>
        )}

        <div className="mt-5"><MonthResults residentId={residentId} month={month} onLoaded={(m, b) => setNums({ m, b })} /></div>
      </div>
    </div>
  );
}
