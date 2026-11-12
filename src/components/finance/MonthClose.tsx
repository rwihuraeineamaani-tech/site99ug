import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceLock } from "@/components/finance/FinanceLock";
import { useMyRoles } from "@/hooks/useMyRoles";

type Close = { month: string; finance_signed_at: string | null; founder_signed_at: string | null; locked: boolean; note: string | null };

/** Statement matching progress and the two-signature month lock for one cashbook month (YYYY-MM). */
export default function MonthClose({ month, total, ticked, onChanged }: { month: string; total: number; ticked: number; onChanged: () => void }) {
  const { require: requirePin } = useFinanceLock();
  const { has } = useMyRoles();
  const [close, setClose] = useState<Close | null>(null);
  const first = `${month}-01`;
  const load = useCallback(async () => {
    const { data } = await supabase.from("period_closes").select("*").eq("month", first).maybeSingle();
    setClose((data as Close) ?? null);
  }, [first]);
  useEffect(() => { load(); }, [load]);

  const sign = async () => {
    if (!(await requirePin())) return;
    const { error } = await supabase.rpc("sign_period_close", { _month: first, _note: null } as never);
    if (error) return toast.error(error.message);
    toast.success("Signed."); load(); onChanged();
  };
  const reopen = async () => {
    const reason = prompt("Why reopen this month?");
    if (!reason) return;
    const { error } = await supabase.rpc("reopen_period", { _month: first, _reason: reason } as never);
    if (error) return toast.error(error.message);
    toast.success("Month reopened."); load(); onChanged();
  };
  const pct = total ? Math.round((ticked / total) * 100) : 0;
  const btn = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";

  return (
    <div className="mb-4 rounded-2xl border border-rule bg-paper-raised p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Matched to the bank and mobile money statements</span>
            <span className="num text-ink-soft">{ticked} of {total}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-rule"><div className="h-full bg-signal transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {close?.locked ? (
            <>
              <span className="rounded-full bg-signal/15 px-3 py-1 font-semibold text-signal">Month closed and locked</span>
              {has("founder", "admin") && <button className={btn} onClick={reopen}>Reopen</button>}
            </>
          ) : (
            <>
              <span className="text-ink-soft">Finance {close?.finance_signed_at ? "signed" : "not signed"} · Co-founder {close?.founder_signed_at ? "signed" : "not signed"}</span>
              <button className={btn} disabled={!total || ticked < total} onClick={sign} title={ticked < total ? "Tick every entry first" : ""}>Sign off month</button>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">Tick each entry once you see it on the statement. When all are ticked, Finance and a Co-founder both sign, and the month locks so nobody can change it.</p>
    </div>
  );
}
