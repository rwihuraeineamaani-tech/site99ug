import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading, StatusChip, Money } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { PAY_METHODS, SOURCE_LABEL, dayLabel } from "@/lib/finance";

type Due = {
  key: string;
  source_kind: "cash_request" | "run_line" | "loan_disbursement" | "invoice";
  source_id: string;
  payee: string;
  amount: number;
  what: string;
};

type Wallet = { id: string; name: string; kind: string };
type Approver = { user_id: string; name: string };


type Txn = {
  id: string;
  txn_ref: string;
  direction: string;
  payee_name: string;
  amount_ugx: number;
  category: string;
  method: string | null;
  method_reference: string | null;
  invoice_no: string | null;
  source_kind: string;
  paid_at: string;
  reverses_txn_id: string | null;
};

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill =
  "press rounded-full border px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50 border-rule bg-paper-raised";

export default function PaymentBoardPanel({ onChanged }: { onChanged?: () => void }) {
  const { canSeeFinance, has } = useMyRoles();
  const isFounder = has("admin", "founder");
  const [due, setDue] = useState<Due[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [open, setOpen] = useState<Due | null>(null);
  const [method, setMethod] = useState(PAY_METHODS[0]);
  const [reference, setReference] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [pin, setPin] = useState("");
  const [comment, setComment] = useState("");
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [secondUser, setSecondUser] = useState("");
  const [secondPin, setSecondPin] = useState("");
  const [threshold, setThreshold] = useState(1_000_000);

  const load = useCallback(async () => {
    const [{ data: reqs }, { data: lines }, { data: loans }, { data: bills }, { data: tx }] = await Promise.all([
      supabase.from("cash_requests").select("id, amount_ugx, purpose, requester, status").eq("status", "approved"),
      supabase.from("payment_run_lines").select("id, payee_name, amount_ugx, category, status").eq("status", "approved"),
      supabase.from("loans").select("id, counterparty_name, principal_ugx, status, direction").eq("status", "active"),
      supabase
        .from("invoices")
        .select("id, party_name, total_ugx, amount_paid_ugx, category, number, status, direction")
        .eq("direction", "in")
        .in("status", ["approved", "part_paid"]),
      supabase.from("transactions").select("*").order("paid_at", { ascending: false }).limit(40),
    ]);
    const [{ data: team }, { data: wl }, { data: roleRows }, { data: settings }] = await Promise.all([
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase.from("wallets").select("id, name, kind").eq("active", true).order("sort"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "founder", "managing_director"]),
      supabase.from("finance_settings").select("dual_pin_threshold_ugx").eq("id", 1).maybeSingle(),
    ]);
    const names: Record<string, string> = {};
    (team ?? []).forEach((t) => (names[t.user_id] = t.display_name || t.email || "Team member"));
    setWallets(((wl as Wallet[]) ?? []));
    setWalletId((w) => w || (wl?.[0]?.id ?? ""));
    const seen = new Set<string>();
    setApprovers(
      ((roleRows as { user_id: string }[]) ?? [])
        .filter((r) => (seen.has(r.user_id) ? false : (seen.add(r.user_id), true)))
        .map((r) => ({ user_id: r.user_id, name: names[r.user_id] ?? "Leadership" }))
    );
    if (settings?.dual_pin_threshold_ugx) setThreshold(settings.dual_pin_threshold_ugx);

    const list: Due[] = [
      ...((reqs ?? []) as { id: string; amount_ugx: number; purpose: string; requester: string }[]).map((r) => ({
        key: `c-${r.id}`,
        source_kind: "cash_request" as const,
        source_id: r.id,
        payee: names[r.requester] ?? "Team member",
        amount: r.amount_ugx,
        what: r.purpose,
      })),
      ...((lines ?? []) as { id: string; payee_name: string; amount_ugx: number; category: string }[]).map((l) => ({
        key: `l-${l.id}`,
        source_kind: "run_line" as const,
        source_id: l.id,
        payee: l.payee_name,
        amount: l.amount_ugx,
        what: `Monthly ${l.category}`,
      })),
      ...((loans ?? []) as { id: string; counterparty_name: string; principal_ugx: number; direction: string }[])
        .filter((l) => l.direction === "out")
        .map((l) => ({
          key: `n-${l.id}`,
          source_kind: "loan_disbursement" as const,
          source_id: l.id,
          payee: l.counterparty_name,
          amount: l.principal_ugx,
          what: "Loan to pay out",
        })),
      ...((bills ?? []) as { id: string; party_name: string; total_ugx: number; amount_paid_ugx: number; number: string | null; category: string }[]).map(
        (b) => ({
          key: `i-${b.id}`,
          source_kind: "invoice" as const,
          source_id: b.id,
          payee: b.party_name,
          amount: b.total_ugx - b.amount_paid_ugx,
          what: `Bill${b.number ? ` ${b.number}` : ""} · ${b.category.replace(/_/g, " ")}`,
        })
      ),
    ];
    setDue(list);
    setTxns(((tx as Txn[]) ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needsSecond = !!open && open.amount >= threshold;

  const pay = async () => {
    if (!open) return;
    if (!walletId) return toast.error("Say which account the money left.");
    if (!/^\d{6}$/.test(pin)) return toast.error("Enter your six-digit payment PIN.");
    if (!reference.trim()) return toast.error("A transaction ID is required as evidence.");
    if (needsSecond && (!secondUser || !/^\d{6}$/.test(secondPin)))
      return toast.error("A second Founder or MD has to release a payment this size.");
    setBusy(true);
    let invoicePath: string | null = null;
    if (file) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      const key = `invoices/${crypto.randomUUID()}-${clean}`;
      const { error: upErr } = await supabase.storage.from("finance-files").upload(key, file);
      if (upErr) {
        setBusy(false);
        return toast.error(upErr.message);
      }
      invoicePath = key;
    }
    const { error } = await supabase.rpc("record_payment", {
      _source_kind: open.source_kind,
      _source_id: open.source_id,
      _method: method,
      _method_reference: reference.trim(),
      _invoice_no: invoiceNo || undefined,
      _invoice_path: invoicePath || undefined,
      _note: comment || undefined,
      _paid_on: paidOn || undefined,
      _wallet_id: walletId,
      _pin: pin,
      _second_user: needsSecond ? secondUser : undefined,
      _second_pin: needsSecond ? secondPin : undefined,
    });
    setBusy(false);
    setPin("");
    setSecondPin("");
    if (error) return toast.error(error.message);
    toast.success("Payment recorded.");
    setOpen(null);
    setReference("");
    setInvoiceNo("");
    setComment("");
    setSecondUser("");
    setFile(null);
    load();
    onChanged?.();
  };


  const reverse = async (id: string) => {
    const reason = window.prompt("Why is this being reversed?");
    if (!reason) return;
    const { error } = await supabase.rpc("reverse_transaction", { _txn_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Reversed.");
    load();
  };

  if (!canSeeFinance) return null;

  const total = due.reduce((s, d) => s + d.amount, 0);

  return (
    <section className="space-y-10">
      <div>
        <SectionHeading index="01" title="Cleared for payment" hint={`${due.length} waiting`} />
        <p className="text-sm text-ink-soft mb-4">
          Total to pay out <Money amount={total} className="font-semibold" />
        </p>
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {due.map((d) => (
            <li key={d.key} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="font-medium">{d.payee}</span>
              <span className="text-sm text-ink-soft min-w-0 truncate">{d.what}</span>
              <StatusChip value={SOURCE_LABEL[d.source_kind]} tone="violet" />
              <Money amount={d.amount} className="font-semibold" />
              <button className="ctl ctl-solid eyebrow px-3 py-1.5 focus-ring ml-auto" onClick={() => setOpen(d)}>
                Mark paid
              </button>
            </li>
          ))}
          {due.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">Nothing waiting to be paid.</li>}
        </ul>
      </div>

      {open && (
        <div className="surface rounded-2xl p-4">
          <SectionHeading index="—" title={`Pay ${open.payee}`} hint={open.what} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">How it was paid</span>
              <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Transaction ID</span>
              <input className={field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo / bank reference" />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Invoice number</span>
              <input className={field} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Date paid</span>
              <input className={field} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Account it left</span>
              <select className={field} value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                <option value="">Choose</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Invoice or receipt</span>
              <input className={field} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Comment</span>
              <input className={field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the auditor should know" />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Your payment PIN</span>
              <input
                className={field}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="6 digits"
              />
            </label>
            {needsSecond && (
              <>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Second release — Founder or MD</span>
                  <select className={field} value={secondUser} onChange={(e) => setSecondUser(e.target.value)}>
                    <option value="">Choose</option>
                    {approvers.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Their PIN</span>
                  <input
                    className={field}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={secondPin}
                    onChange={(e) => setSecondPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 digits"
                  />
                </label>
              </>
            )}

            <div className="flex items-end gap-2">
              <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={pay}>
                Record payment
              </button>
              <button className={pill} onClick={() => setOpen(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <SectionHeading index="02" title="Money that has moved" hint="Newest first" />
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {txns.map((t) => (
            <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <Link to={`/app/finance/t/${t.id}`} className="num text-xs text-signal focus-ring">
                {t.txn_ref}
              </Link>
              <span className="font-medium">{t.payee_name}</span>
              <Money amount={t.direction === "in" ? t.amount_ugx : -t.amount_ugx} signed className="font-semibold" />
              <StatusChip value={SOURCE_LABEL[t.source_kind] ?? t.source_kind} tone="neutral" />
              <span className="text-[11px] text-ink-faint">
                {t.method ?? "—"}
                {t.method_reference ? ` · ${t.method_reference}` : ""} · {dayLabel(t.paid_at)}
              </span>
              {isFounder && !t.reverses_txn_id && (
                <button className={`${pill} ml-auto`} onClick={() => reverse(t.id)}>
                  Reverse
                </button>
              )}
            </li>
          ))}
          {txns.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No payments recorded yet.</li>}
        </ul>
      </div>
    </section>
  );
}
