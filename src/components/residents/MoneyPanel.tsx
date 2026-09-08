import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHeading, StatusChip } from "@/components/system";
import {
  PAY_METHODS,
  addFunds,
  dayLabel,
  loadClientMoney,
  potBalance,
  todayKampala,
  ugx,
  type FundLine,
  type SpendLine,
} from "@/lib/clientMoney";
import { Plus, Wallet } from "lucide-react";

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

/** The client's money pot: what they have put in, and what has been spent from it. */
export default function MoneyPanel({
  residentId,
  canTopUp,
  index = "01",
}: {
  residentId: string;
  canTopUp: boolean;
  index?: string;
}) {
  const [funds, setFunds] = useState<FundLine[]>([]);
  const [spend, setSpend] = useState<SpendLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    direction: "top_up" as "top_up" | "refund",
    amount: "",
    received_on: todayKampala(),
    method: "mobile money",
    reference: "",
    note: "",
  });

  const load = async () => {
    const m = await loadClientMoney(residentId);
    setFunds(m.funds);
    setSpend(m.spend);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [residentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => potBalance(funds, spend), [funds, spend]);

  const save = async () => {
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) return toast.error("Put in an amount first.");
    setBusy(true);
    try {
      await addFunds({
        residentId,
        direction: draft.direction,
        amount,
        receivedOn: draft.received_on,
        method: draft.method,
        reference: draft.reference || null,
        note: draft.note || null,
      });
      toast.success(draft.direction === "top_up" ? "Money added to the pot" : "Refund recorded");
      setOpen(false);
      setDraft({ ...draft, amount: "", reference: "", note: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    }
    setBusy(false);
  };

  return (
    <section className="space-y-4">
      <SectionHeading index={index} title="Client money pot" note="Money the client has put in, and what it has paid for." />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-rule bg-paper-raised p-4">
          <div className="eyebrow text-ink-faint">Left in the pot</div>
          <div className="num mt-1 text-2xl">{ugx(totals.balance)}</div>
        </div>
        <div className="rounded-xl border border-rule bg-paper-sunken p-4">
          <div className="eyebrow text-ink-faint">Put in so far</div>
          <div className="num mt-1 text-xl">{ugx(totals.inflow)}</div>
        </div>
        <div className="rounded-xl border border-rule bg-paper-sunken p-4">
          <div className="eyebrow text-ink-faint">Spent from the pot</div>
          <div className="num mt-1 text-xl">{ugx(totals.clientPaid)}</div>
        </div>
      </div>

      {canTopUp && (
        <div>
          {open ? (
            <div className="rounded-xl border border-rule bg-paper-raised p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">What is this</span>
                  <select
                    className={field}
                    value={draft.direction}
                    onChange={(e) => setDraft({ ...draft, direction: e.target.value as "top_up" | "refund" })}
                  >
                    <option value="top_up">Money in</option>
                    <option value="refund">Money returned to the client</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Amount (UGX)</span>
                  <input
                    className={field}
                    inputMode="numeric"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^0-9]/g, "") })}
                  />
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Date</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.received_on}
                    onChange={(e) => setDraft({ ...draft, received_on: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">How it came</span>
                  <select className={field} value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })}>
                    {PAY_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Reference</span>
                  <input className={field} value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Note</span>
                  <input className={field} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add money to the pot
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-rule bg-paper-sunken p-4">
        <div className="eyebrow text-ink-faint">History</div>
        {loading ? (
          <p className="mt-2 text-xs text-ink-soft">Loading…</p>
        ) : funds.length === 0 && spend.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">Nothing yet. Once the client puts money in, it shows here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {[
              ...funds.map((f) => ({
                id: `f-${f.id}`,
                when: f.received_on,
                label: f.direction === "top_up" ? "Money in" : "Refund",
                detail: [f.method, f.reference, f.note].filter(Boolean).join(" · "),
                amount: f.direction === "top_up" ? f.amount_ugx : -f.amount_ugx,
              })),
              ...spend
                .filter((s) => s.payer === "client")
                .map((s) => ({
                  id: `s-${s.id}`,
                  when: s.spent_on,
                  label: `Spent · ${s.category}`,
                  detail: s.note ?? "",
                  amount: -s.amount_ugx,
                })),
            ]
              .sort((a, b) => b.when.localeCompare(a.when))
              .map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Wallet className="h-3.5 w-3.5 text-ink-faint" />
                  <span>{row.label}</span>
                  {row.detail && <span className="text-xs text-ink-faint truncate">{row.detail}</span>}
                  <span className="ml-auto text-xs text-ink-faint">{dayLabel(row.when)}</span>
                  <span className={`num w-32 text-right ${row.amount < 0 ? "text-ink-soft" : ""}`}>
                    {row.amount < 0 ? `- ${ugx(-row.amount)}` : ugx(row.amount)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-faint">
        <StatusChip value="note" tone="neutral" className="mr-2" />
        Retainers and team splits stay under Management. Contracts stay under Legal.
      </p>
    </section>
  );
}
