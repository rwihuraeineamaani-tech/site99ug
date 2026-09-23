import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Money, StatusChip } from "@/components/system";

type Invoice = {
  id: string;
  number: string | null;
  issue_date: string;
  due_date: string | null;
  total_ugx: number | null;
  amount_paid_ugx: number | null;
  status: string;
  period_label: string | null;
};

type Fund = { id: string; amount_ugx: number; direction: string; received_on: string; method: string | null; note: string | null };
type Spend = { id: string; amount_ugx: number; category: string; note: string | null; spent_on: string };

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function PortalMoney() {
  const { client, clientId, loading } = usePortalClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [spend, setSpend] = useState<Spend[]>([]);
  const [pot, setPot] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [inv, fd, sp, pb] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, number, issue_date, due_date, total_ugx, amount_paid_ugx, status, period_label")
          .eq("resident_id", clientId)
          .eq("direction", "out")
          .order("issue_date", { ascending: false })
          .limit(60),
        supabase
          .from("client_funds")
          .select("id, amount_ugx, direction, received_on, method, note")
          .eq("resident_id", clientId)
          .order("received_on", { ascending: false })
          .limit(60),
        supabase
          .from("shoot_spend")
          .select("id, amount_ugx, category, note, spent_on")
          .eq("resident_id", clientId)
          .eq("payer", "client")
          .order("spent_on", { ascending: false })
          .limit(60),
        supabase.rpc("client_pot_balance", { _resident_id: clientId }),
      ]);
      if (cancelled) return;
      setInvoices((inv.data as Invoice[]) ?? []);
      setFunds((fd.data as Fund[]) ?? []);
      setSpend((sp.data as Spend[]) ?? []);
      setPot(Number(pb.data ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const billed = invoices.reduce((t, i) => t + Number(i.total_ugx ?? 0), 0);
  const paid = invoices.reduce((t, i) => t + Number(i.amount_paid_ugx ?? 0), 0);
  const outstanding = Math.max(0, billed - paid);

  return (
    <PortalPage title="Money" lede="What you have been billed, what you have paid, and your shoot fund." client={client} loading={loading}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PortalCard title="Billed so far">
          <div className="text-lg">
            <Money amount={billed} />
          </div>
        </PortalCard>
        <PortalCard title="Paid">
          <div className="text-lg">
            <Money amount={paid} />
          </div>
        </PortalCard>
        <PortalCard title="Still owed">
          <div className="text-lg">
            <Money amount={outstanding} />
          </div>
        </PortalCard>
        <PortalCard title="Shoot fund left">
          <div className="text-lg">
            <Money amount={pot} />
          </div>
          <div className="text-xs text-ink-faint">Top-ups less what we spent for you.</div>
        </PortalCard>
      </div>

      <div className="mt-6">
        <PortalCard title="Your invoices" hint={`${invoices.length}`}>
          {invoices.length === 0 ? (
            <PortalEmpty>No invoices yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {invoices.map((i) => {
                const owed = Math.max(0, Number(i.total_ugx ?? 0) - Number(i.amount_paid_ugx ?? 0));
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm">
                        {i.number ?? "Draft invoice"}
                        {i.period_label ? ` · ${i.period_label}` : ""}
                      </div>
                      <div className="text-xs text-ink-faint">
                        Issued {fmt(i.issue_date)} · due {fmt(i.due_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Money amount={Number(i.total_ugx ?? 0)} />
                        {owed > 0 && (
                          <div className="text-xs text-ink-faint">
                            <Money amount={owed} /> still owed
                          </div>
                        )}
                      </div>
                      <StatusChip value={i.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PortalCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PortalCard title="Money you put in" hint={`${funds.length}`}>
          {funds.length === 0 ? (
            <PortalEmpty>No top-ups yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {funds.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm">{f.note || (f.direction === "in" ? "Top-up" : "Refund")}</div>
                    <div className="text-xs text-ink-faint">
                      {fmt(f.received_on)}
                      {f.method ? ` · ${f.method}` : ""}
                    </div>
                  </div>
                  <Money amount={f.direction === "in" ? Number(f.amount_ugx) : -Number(f.amount_ugx)} signed />
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="Spent from your fund" hint={`${spend.length}`}>
          {spend.length === 0 ? (
            <PortalEmpty>Nothing spent yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {spend.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{s.note || s.category}</div>
                    <div className="text-xs text-ink-faint">{fmt(s.spent_on)}</div>
                  </div>
                  <Money amount={Number(s.amount_ugx)} />
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
