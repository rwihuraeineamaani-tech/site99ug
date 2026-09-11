import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceLock } from "@/components/finance/FinanceLock";
import { toast } from "sonner";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Money, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, catLabel, dayLabel, todayISO } from "@/lib/finance";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_TONE,
  invoiceTotals,
  isOverdue,
  outstanding,
  type Invoice,
  type InvoiceDirection,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/invoices";

type Contract = {
  id: string;
  title: string;
  party_name: string;
  resident_id: string | null;
  value_ugx: number | null;
  status: string;
};
type Wallet = { id: string; name: string; active: boolean; sort: number };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const on = "border-transparent bg-ink text-paper";

type Draft = {
  direction: InvoiceDirection;
  party_name: string;
  party_kind: string;
  resident_id: string;
  contract_id: string;
  category: string;
  issue_date: string;
  due_date: string;
  period_label: string;
  vatRate: number;
  note: string;
  recurring: boolean;
  recur_day: number;
  lines: { description: string; qty: number; unit: number }[];
};

const emptyDraft = (direction: InvoiceDirection): Draft => ({
  direction,
  party_name: "",
  party_kind: direction === "out" ? "client" : "supplier",
  resident_id: "",
  contract_id: "",
  category: direction === "out" ? "client_payment" : "subscriptions",
  issue_date: todayISO(),
  due_date: "",
  period_label: "",
  vatRate: 0.18,
  note: "",
  recurring: false,
  recur_day: 1,
  lines: [{ description: "", qty: 1, unit: 0 }],
});

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const { require: requirePin } = useFinanceLock();
  const { canSeeFinance, has } = useMyRoles();
  const [tab, setTab] = useState<InvoiceDirection>("out");
  const [rows, setRows] = useState<Invoice[]>([]);
  const [lines, setLines] = useState<Record<string, InvoiceLine[]>>({});
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [residentFilter, setResidentFilter] = useState(() => searchParams.get("resident") ?? "");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [settle, setSettle] = useState<{ inv: Invoice; wallet: string; amount: string; reference: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const [inv, ln, ct, rs, wl] = await Promise.all([
      supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
      supabase.from("invoice_lines").select("*").order("sort"),
      supabase.from("contracts").select("id, title, party_name, resident_id, value_ugx, status"),
      supabase.from("residents").select("id, name").order("display_order"),
      supabase.from("wallets").select("id, name, active, sort").eq("active", true).order("sort"),
    ]);
    setRows((inv.data as Invoice[]) ?? []);
    const map: Record<string, InvoiceLine[]> = {};
    ((ln.data as InvoiceLine[]) ?? []).forEach((l) => {
      (map[l.invoice_id] ??= []).push(l);
    });
    setLines(map);
    setContracts((ct.data as Contract[]) ?? []);
    setResidents((rs.data as { id: string; name: string }[]) ?? []);
    setWallets((wl.data as Wallet[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const residentName = useCallback(
    (id: string | null) => (id ? residents.find((r) => r.id === id)?.name ?? null : null),
    [residents]
  );

  const list = useMemo(
    () => rows.filter((r) => r.direction === tab && (!residentFilter || r.resident_id === residentFilter)),
    [rows, tab, residentFilter]
  );
  const owed = list.filter((r) => r.status !== "paid" && r.status !== "void").reduce((t, r) => t + outstanding(r), 0);

  /* ---------------- create ---------------- */

  const draftTotals = draft
    ? invoiceTotals(
        draft.lines.reduce((t, l) => t + Math.round(l.qty * l.unit), 0),
        draft.vatRate
      )
    : null;

  const prefillFromContract = (id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const c = contracts.find((x) => x.id === id);
      if (!c) return { ...d, contract_id: "" };
      return {
        ...d,
        contract_id: id,
        party_name: c.party_name,
        resident_id: c.resident_id ?? d.resident_id,
        lines: [{ description: c.title, qty: 1, unit: c.value_ugx ?? 0 }],
      };
    });
  };

  const save = async () => {
    if (!draft || !draftTotals) return;
    if (!draft.party_name.trim()) return toast.error("Who is this invoice with?");
    if (draftTotals.total <= 0) return toast.error("Add at least one line with an amount.");
    setBusy(true);

    let path: string | null = null;
    if (file) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      const key = `invoices/${crypto.randomUUID()}-${clean}`;
      const up = await supabase.storage.from("finance-files").upload(key, file);
      if (up.error) {
        setBusy(false);
        return toast.error(up.error.message);
      }
      path = key;
    }

    let number: string | null = null;
    if (draft.direction === "out") {
      const { data, error } = await supabase.rpc("next_invoice_number");
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      number = data as string;
    }

    const { data: created, error } = await supabase
      .from("invoices")
      .insert({
        direction: draft.direction,
        status: "draft",
        number,
        party_kind: draft.party_kind,
        party_name: draft.party_name.trim(),
        resident_id: draft.resident_id || null,
        contract_id: draft.contract_id || null,
        issue_date: draft.issue_date,
        due_date: draft.due_date || null,
        period_label: draft.period_label || null,
        category: draft.category,
        subtotal_ugx: draftTotals.subtotal,
        vat_rate: draft.vatRate,
        vat_ugx: draftTotals.vat,
        total_ugx: draftTotals.total,
        note: draft.note || null,
        file_path: path,
        recurring: draft.recurring,
        recur_day: draft.recurring ? draft.recur_day : null,
      })
      .select("id")
      .single();

    if (error || !created) {
      setBusy(false);
      return toast.error(error?.message ?? "Could not save.");
    }

    const payload = draft.lines
      .filter((l) => l.description.trim() || l.unit)
      .map((l, i) => ({
        invoice_id: created.id,
        description: l.description || "Item",
        qty: l.qty,
        unit_price_ugx: Math.round(l.unit),
        amount_ugx: Math.round(l.qty * l.unit),
        sort: i,
      }));
    if (payload.length) await supabase.from("invoice_lines").insert(payload);

    setBusy(false);
    setDraft(null);
    setFile(null);
    toast.success("Invoice saved.");
    load();
  };

  const setStatus = async (inv: Invoice, status: InvoiceStatus) => {
    const patch: { status: InvoiceStatus; sent_at?: string; approved_at?: string } = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "approved") patch.approved_at = new Date().toISOString();

    const { error } = await supabase.from("invoices").update(patch).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved — it is now on the payment board." : "Updated.");
    load();
  };

  const doSettle = async () => {
    if (!settle) return;
    if (!(await requirePin())) return;
    const amount = Math.round(Number(settle.amount));
    if (!settle.wallet) return toast.error("Which account did the money land in?");
    if (!amount) return toast.error("Enter the amount received.");
    if (!settle.reference.trim()) return toast.error("A transaction ID is required.");
    setBusy(true);
    const { error } = await supabase.rpc("settle_invoice", {
      _invoice_id: settle.inv.id,
      _wallet_id: settle.wallet,
      _amount: amount,
      _reference: settle.reference.trim(),
      _paid_on: todayISO(),
      _note: settle.note || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Money in recorded.");
    setSettle(null);
    load();
  };

  const runRecurring = async () => {
    const { data, error } = await supabase.rpc("raise_recurring_invoices");
    if (error) return toast.error(error.message);
    toast.success(data ? `${data} recurring bill(s) raised.` : "Nothing due yet.");
    load();
  };

  const printInvoice = (inv: Invoice) => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const ug = (n: number) => `UGX ${Math.round(n).toLocaleString("en-UG")}`;
    const ls = lines[inv.id] ?? [];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number ?? "Invoice")}</title>
<style>@page{size:A4;margin:18mm}body{font:12px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#111}
h1{font-size:26px;margin:0}.row{display:flex;justify-content:space-between;gap:24px;margin-top:24px}
table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px;border-bottom:1px solid #e5e5e5;text-align:left}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#666}td.n,th.n{text-align:right}
tr.t td{font-weight:700;border-top:2px solid #111;border-bottom:none}.muted{color:#666;font-size:11px}</style></head><body>
<h1>Site 99</h1><div class="muted">Kampala, Uganda</div>
<div class="row"><div><div class="muted">Billed to</div><strong>${esc(inv.party_name)}</strong></div>
<div style="text-align:right"><div class="muted">Invoice</div><strong>${esc(inv.number ?? "—")}</strong>
<div class="muted">Issued ${esc(inv.issue_date)}${inv.due_date ? ` · due ${esc(inv.due_date)}` : ""}</div>
${inv.period_label ? `<div class="muted">${esc(inv.period_label)}</div>` : ""}</div></div>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>
${ls.map((l) => `<tr><td>${esc(l.description)}</td><td class="n">${esc(l.qty)}</td><td class="n">${esc(ug(l.unit_price_ugx))}</td><td class="n">${esc(ug(l.amount_ugx))}</td></tr>`).join("")}
<tr><td colspan="3">Subtotal</td><td class="n">${esc(ug(inv.subtotal_ugx))}</td></tr>
<tr><td colspan="3">VAT ${Math.round(inv.vat_rate * 100)}%</td><td class="n">${esc(ug(inv.vat_ugx))}</td></tr>
<tr class="t"><td colspan="3">Total due</td><td class="n">${esc(ug(inv.total_ugx))}</td></tr>
</tbody></table>
${inv.note ? `<p class="muted">${esc(inv.note)}</p>` : ""}
<p class="muted">Payment by mobile money or bank transfer. Please quote the invoice number on the transfer.</p>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("finance-files").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!canSeeFinance) return null;
  const canApprove = has("admin", "founder", "managing_director", "finance_ops");

  return (
    <FinancePage
      title="Invoices"
      lede="What clients owe us, what suppliers have billed us, and the bills that repeat every month."
      path="/app/finance/invoices"
      actions={
        <div className="flex flex-wrap gap-2">
          <button className={pill} onClick={runRecurring}>
            Raise recurring bills
          </button>
          <button className="ctl ctl-solid eyebrow px-4 py-2 focus-ring" onClick={() => setDraft(emptyDraft(tab))}>
            New {tab === "out" ? "invoice" : "bill"}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <button className={`${pill} ${tab === "out" ? on : ""}`} onClick={() => setTab("out")}>
          We issued
        </button>
        <button className={`${pill} ${tab === "in" ? on : ""}`} onClick={() => setTab("in")}>
          We received
        </button>
        <select
          aria-label="Filter by client"
          className="rounded-lg border border-rule bg-paper-raised px-3 py-1.5 text-xs outline-none focus:border-signal"
          value={residentFilter}
          onChange={(e) => setResidentFilter(e.target.value)}
        >
          <option value="">All clients</option>
          {residents.map((resident) => (
            <option key={resident.id} value={resident.id}>
              {resident.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-ink-soft">
          Outstanding <Money amount={owed} className="font-semibold" />
        </span>
      </div>

      {draft && (
        <div className="surface rounded-2xl p-5 mb-10">
          <SectionHeading index="—" title={draft.direction === "out" ? "New invoice to a client" : "New bill we received"} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draft.direction === "out" && (
              <label className="text-sm">
                <span className="eyebrow text-ink-faint">Prefill from a contract</span>
                <select className={field} value={draft.contract_id} onChange={(e) => prefillFromContract(e.target.value)}>
                  <option value="">No contract</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.party_name} — {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">{draft.direction === "out" ? "Client" : "Supplier"}</span>
              <input className={field} value={draft.party_name} onChange={(e) => setDraft({ ...draft, party_name: e.target.value })} placeholder={draft.direction === "out" ? "Client name" : "Google Workspace"} />
            </label>
            {draft.direction === "out" && (
              <label className="text-sm">
                <span className="eyebrow text-ink-faint">Linked client</span>
                <select
                  className={field}
                  value={draft.resident_id}
                  onChange={(e) => {
                    const residentId = e.target.value;
                    const name = residents.find((resident) => resident.id === residentId)?.name;
                    setDraft({ ...draft, resident_id: residentId, party_name: name ?? draft.party_name });
                  }}
                >
                  <option value="">None</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Category</span>
              <select className={field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {(draft.direction === "out" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Issue date</span>
              <input type="date" className={field} value={draft.issue_date} onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Due date</span>
              <input type="date" className={field} value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Period covered</span>
              <input className={field} value={draft.period_label} onChange={(e) => setDraft({ ...draft, period_label: e.target.value })} placeholder="Sep 2026" />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">VAT</span>
              <select className={field} value={draft.vatRate} onChange={(e) => setDraft({ ...draft, vatRate: Number(e.target.value) })}>
                <option value={0.18}>18% standard</option>
                <option value={0}>No VAT</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Invoice file</span>
              <input type="file" className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="mt-5">
            <div className="eyebrow text-ink-faint mb-2">Lines</div>
            <div className="space-y-2">
              {draft.lines.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_160px_auto] items-center">
                  <input
                    className={field}
                    value={l.description}
                    placeholder="What it is for"
                    onChange={(e) => {
                      const ls = [...draft.lines];
                      ls[i] = { ...l, description: e.target.value };
                      setDraft({ ...draft, lines: ls });
                    }}
                  />
                  <input
                    className={field}
                    type="number"
                    value={l.qty}
                    onChange={(e) => {
                      const ls = [...draft.lines];
                      ls[i] = { ...l, qty: Number(e.target.value) };
                      setDraft({ ...draft, lines: ls });
                    }}
                  />
                  <input
                    className={field}
                    type="number"
                    value={l.unit}
                    onChange={(e) => {
                      const ls = [...draft.lines];
                      ls[i] = { ...l, unit: Number(e.target.value) };
                      setDraft({ ...draft, lines: ls });
                    }}
                  />
                  <button
                    className={pill}
                    onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, x) => x !== i) })}
                    disabled={draft.lines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className={`${pill} mt-2`} onClick={() => setDraft({ ...draft, lines: [...draft.lines, { description: "", qty: 1, unit: 0 }] })}>
              Add line
            </button>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.recurring} onChange={(e) => setDraft({ ...draft, recurring: e.target.checked })} />
            This repeats every month
            {draft.recurring && (
              <input
                type="number"
                min={1}
                max={28}
                className="w-20 rounded-lg border border-rule bg-paper-raised px-2 py-1 text-sm"
                value={draft.recur_day}
                onChange={(e) => setDraft({ ...draft, recur_day: Number(e.target.value) })}
              />
            )}
            {draft.recurring && <span className="text-ink-faint text-xs">day of the month</span>}
          </label>

          <label className="text-sm block mt-3">
            <span className="eyebrow text-ink-faint">Note</span>
            <textarea className={field} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-soft">
              Subtotal <Money amount={draftTotals?.subtotal ?? 0} /> · VAT <Money amount={draftTotals?.vat ?? 0} /> · Total{" "}
              <Money amount={draftTotals?.total ?? 0} className="font-semibold" />
            </span>
            <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring ml-auto" disabled={busy} onClick={save}>
              Save
            </button>
            <button className={pill} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <SectionHeading index="01" title={tab === "out" ? "Invoices we issued" : "Bills we received"} hint={`${list.length} on file`} />
      <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
        {list.map((inv) => (
          <li key={inv.id}>
            <button className="w-full px-4 py-3 text-left flex flex-wrap items-center gap-3 focus-ring" onClick={() => setOpenId(openId === inv.id ? null : inv.id)}>
              <span className="num text-xs text-ink-faint">{inv.number ?? "—"}</span>
              <span className="font-medium">{inv.party_name}</span>
              {residentName(inv.resident_id) && <StatusChip tone="blue" value={residentName(inv.resident_id) ?? "Client"} />}
              <span className="text-sm text-ink-soft">{inv.period_label ?? catLabel(inv.category)}</span>
              <StatusChip tone={INVOICE_TONE[inv.status]} value={INVOICE_STATUS_LABEL[inv.status]} />
              {inv.recurring && <StatusChip tone="violet" value="Monthly" />}
              {isOverdue(inv) && <StatusChip tone="stop" value="Overdue" />}
              <Money amount={inv.total_ugx} className="ml-auto font-semibold" />
            </button>
            {openId === inv.id && (
              <div className="px-4 pb-4 space-y-3">
                <ul className="text-sm text-ink-soft space-y-1">
                  {(lines[inv.id] ?? []).map((l) => (
                    <li key={l.id} className="flex gap-3">
                      <span>{l.description}</span>
                      <span className="text-ink-faint">
                        {l.qty} × <Money amount={l.unit_price_ugx} />
                      </span>
                      <Money amount={l.amount_ugx} className="ml-auto" />
                    </li>
                  ))}
                </ul>
                <div className="text-sm text-ink-soft">
                  Issued {dayLabel(inv.issue_date)}
                  {inv.due_date ? ` · due ${dayLabel(inv.due_date)}` : ""} · paid <Money amount={inv.amount_paid_ugx} /> · outstanding{" "}
                  <Money amount={outstanding(inv)} className="font-semibold" />
                </div>
                {inv.note && <p className="text-sm text-ink-soft">{inv.note}</p>}
                <div className="flex flex-wrap gap-2">
                  {inv.file_path && (
                    <button className={pill} onClick={() => inv.file_path && openFile(inv.file_path)}>
                      Open file
                    </button>
                  )}
                  {inv.direction === "out" && (
                    <>
                      <button className={pill} onClick={() => printInvoice(inv)}>
                        Print / PDF
                      </button>
                      {inv.status === "draft" && (
                        <button className={pill} onClick={() => setStatus(inv, "sent")}>
                          Mark sent
                        </button>
                      )}
                      {inv.status !== "paid" && inv.status !== "void" && (
                        <button
                          className={pill}
                          onClick={() => setSettle({ inv, wallet: wallets[0]?.id ?? "", amount: String(outstanding(inv)), reference: "", note: "" })}
                        >
                          Record money in
                        </button>
                      )}
                    </>
                  )}
                  {inv.direction === "in" && inv.status === "draft" && canApprove && (
                    <button className={pill} onClick={() => setStatus(inv, "approved")}>
                      Approve for payment
                    </button>
                  )}
                  {inv.direction === "in" && inv.status === "approved" && (
                    <span className="text-xs text-ink-faint self-center">Waiting on the payment board — released with a PIN.</span>
                  )}
                  {inv.status !== "void" && inv.status !== "paid" && (
                    <button className={pill} onClick={() => setStatus(inv, "void")}>
                      Void
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {!list.length && <li className="px-4 py-3 text-sm text-ink-soft">Nothing here yet.</li>}
      </ul>

      {settle && (
        <div className="surface rounded-2xl p-5 mt-8">
          <SectionHeading index="—" title={`Money in from ${settle.inv.party_name}`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Account it landed in</span>
              <select className={field} value={settle.wallet} onChange={(e) => setSettle({ ...settle, wallet: e.target.value })}>
                <option value="">Choose</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Amount</span>
              <input className={field} type="number" value={settle.amount} onChange={(e) => setSettle({ ...settle, amount: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Transaction ID</span>
              <input className={field} value={settle.reference} onChange={(e) => setSettle({ ...settle, reference: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Comment</span>
              <input className={field} value={settle.note} onChange={(e) => setSettle({ ...settle, note: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={doSettle}>
              Record it
            </button>
            <button className={pill} onClick={() => setSettle(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </FinancePage>
  );
}
