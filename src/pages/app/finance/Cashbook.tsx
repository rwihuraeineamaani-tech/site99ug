import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Money, SearchInput, SelectFilter, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  CAPEX_CATEGORIES,
  COUNTERPARTY_KINDS,
  INCOME_CATEGORIES,
  NON_COST_CATEGORIES,
  OPEX_CATEGORIES,
  SOURCE_LABEL,
  SPEND_LABEL,
  TAX_DISCLAIMER,
  TAX_HEADLINES,
  catLabel,
  csv,
  dayLabel,
  download,
  monthBounds,
  spendKind,
  taxRule,
  todayISO,
} from "@/lib/finance";

type Wallet = { id: string; name: string; kind: string; active: boolean; sort: number };
type Balance = { wallet_id: string; wallet_name: string; balance: number; money_in: number; money_out: number };
type Entry = {
  id: string;
  wallet_id: string;
  direction: string;
  amount_ugx: number;
  entry_date: string;
  category: string;
  counterparty_name: string;
  counterparty_kind: string;
  resident_id: string | null;
  project_id: string | null;
  note: string | null;
  reference: string | null;
  attachment_path: string | null;
  transaction_id: string | null;
  reverses_id: string | null;
};
type Txn = {
  id: string;
  txn_ref: string;
  source_kind: string;
  payee_name: string;
  amount_ugx: number;
  method: string | null;
  method_reference: string | null;
  invoice_no: string | null;
  paid_at: string;
};
type Resident = { id: string; name: string };
type Project = { id: string; title: string };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";

const spendTone = (k: string): "violet" | "amber" | "neutral" =>
  k === "capex" ? "violet" : k === "opex" ? "amber" : "neutral";
const spendChip = (k: string) => (k === "capex" ? "Capital" : k === "opex" ? "Running cost" : "Not a cost");

export default function Cashbook() {
  const { canSeeFinance, has } = useMyRoles();
  const canLog = canSeeFinance || has("admin", "founder");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [txns, setTxns] = useState<Record<string, Txn>>({});
  const [residents, setResidents] = useState<Resident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [walletFilter, setWalletFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState<"entry" | "transfer" | null>(null);
  const [busy, setBusy] = useState(false);

  // entry form
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("general");
  const [who, setWho] = useState("");
  const [whoKind, setWhoKind] = useState("supplier");
  const [tagged, setTagged] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // transfer form
  const [fromW, setFromW] = useState("");
  const [toW, setToW] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tDate, setTDate] = useState(todayISO());
  const [tNote, setTNote] = useState("");

  const load = useCallback(async () => {
    const { from, to } = monthBounds(month);
    const [w, b, e, r, p, t] = await Promise.all([
      supabase.from("wallets").select("id, name, kind, active, sort").order("sort"),
      supabase.rpc("wallet_balances"),
      supabase
        .from("cashbook_entries")
        .select("*")
        .gte("entry_date", from)
        .lt("entry_date", to)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.rpc("resident_options"),
      supabase.from("projects").select("id, title").order("title"),
      supabase
        .from("transactions")
        .select("id, txn_ref, source_kind, payee_name, amount_ugx, method, method_reference, invoice_no, paid_at")
        .gte("paid_at", `${from}T00:00:00`)
        .lt("paid_at", `${to}T00:00:00`),
    ]);
    setWallets((w.data as Wallet[]) ?? []);
    setBalances((b.data as Balance[]) ?? []);
    setRows((e.data as Entry[]) ?? []);
    setResidents(((r.data as Resident[]) ?? []).map((x) => ({ id: x.id, name: x.name })));
    setProjects((p.data as Project[]) ?? []);
    const map: Record<string, Txn> = {};
    ((t.data as Txn[]) ?? []).forEach((x) => (map[x.id] = x));
    setTxns(map);
    if (!walletId && w.data?.length) setWalletId((w.data as Wallet[])[0].id);
    setLoading(false);
  }, [month, walletId]);

  useEffect(() => {
    load();
  }, [load]);

  const walletName = (id: string) => wallets.find((w) => w.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (walletFilter !== "all" && r.wallet_id !== walletFilter) return false;
      if (dirFilter !== "all" && r.direction !== dirFilter) return false;
      if (kindFilter !== "all") {
        if (r.direction !== "out") return false;
        if (spendKind(r.category) !== kindFilter) return false;
      }
      if (sourceFilter === "board" && !r.transaction_id) return false;
      if (sourceFilter === "manual" && r.transaction_id) return false;
      if (!needle) return true;
      const txn = r.transaction_id ? txns[r.transaction_id] : undefined;
      return [r.counterparty_name, r.note, r.reference, r.category, txn?.txn_ref]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, walletFilter, dirFilter, kindFilter, sourceFilter, q, txns]);

  const totals = useMemo(() => {
    let inn = 0;
    let out = 0;
    let capex = 0;
    let opex = 0;
    let neither = 0;
    let taxable = 0;
    let notTaxable = 0;
    filtered.forEach((r) => {
      if (r.direction === "in") {
        inn += r.amount_ugx;
        const rule = taxRule(r.category);
        if (rule.income === "taxable") taxable += r.amount_ugx;
        else notTaxable += r.amount_ugx;
      } else {
        out += r.amount_ugx;
        const k = spendKind(r.category);
        if (k === "capex") capex += r.amount_ugx;
        else if (k === "opex") opex += r.amount_ugx;
        else neither += r.amount_ugx;
      }
    });
    return { inn, out, net: inn - out, capex, opex, neither, taxable, notTaxable };
  }, [filtered]);

  /** One row per category used this month, with its Uganda tax treatment. */
  const taxRows = useMemo(() => {
    const byCat: Record<string, { cat: string; direction: string; total: number; count: number }> = {};
    filtered.forEach((r) => {
      const key = `${r.direction}:${r.category}`;
      byCat[key] ??= { cat: r.category, direction: r.direction, total: 0, count: 0 };
      byCat[key].total += r.amount_ugx;
      byCat[key].count += 1;
    });
    return Object.values(byCat).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const fromBoard = filtered.filter((r) => r.transaction_id);
  const unlinkedTxns = Object.values(txns).filter((t) => !rows.some((r) => r.transaction_id === t.id));
  const total = balances.reduce((s, b) => s + Number(b.balance ?? 0), 0);

  const resetEntry = () => {
    setAmount("");
    setWho("");
    setNote("");
    setReference("");
    setTagged("");
    setFile(null);
  };

  const saveEntry = async () => {
    const amt = Math.round(Number(amount));
    if (!walletId || !amt || amt <= 0) return toast.error("Pick a wallet and a real amount.");
    if (!who.trim()) return toast.error(direction === "in" ? "Who sent the money?" : "Who was paid?");
    setBusy(true);
    let path: string | null = null;
    if (file) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${clean}`;
      const up = await supabase.storage.from("cashbook-receipts").upload(path, file);
      if (up.error) {
        setBusy(false);
        return toast.error(up.error.message);
      }
    }
    const { error } = await supabase.rpc("log_cashbook_entry", {
      _wallet_id: walletId,
      _direction: direction,
      _amount: amt,
      _entry_date: date,
      _category: category,
      _counterparty_name: who,
      _counterparty_kind: whoKind,
      _resident_id: tagged.startsWith("r:") ? tagged.slice(2) : undefined,
      _project_id: tagged.startsWith("p:") ? tagged.slice(2) : undefined,
      _note: note || undefined,
      _reference: reference || undefined,
      _attachment_path: path ?? undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Logged in the cashbook.");
    resetEntry();
    setOpen(null);
    load();
  };

  const saveTransfer = async () => {
    const amt = Math.round(Number(tAmount));
    if (!fromW || !toW || fromW === toW || !amt) return toast.error("Pick two different wallets and an amount.");
    setBusy(true);
    const { error } = await supabase.rpc("transfer_between_wallets", {
      _from: fromW,
      _to: toW,
      _amount: amt,
      _entry_date: tDate,
      _note: tNote || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transfer recorded.");
    setTAmount("");
    setTNote("");
    setOpen(null);
    load();
  };

  const reverse = async (row: Entry) => {
    const reason = window.prompt("Why is this being reversed?");
    if (!reason) return;
    const { error } = await supabase.rpc("reverse_cashbook_entry", { _id: row.id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Reversed — both lines stay on the record.");
    load();
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("cashbook-receipts").createSignedUrl(path, 120);
    if (error || !data) return toast.error(error?.message ?? "Could not open that file.");
    window.open(data.signedUrl, "_blank");
  };

  const exportCsv = () => {
    download(
      `cashbook-${month}.csv`,
      csv([
        [
          "Date",
          "Wallet",
          "In/Out",
          "Amount UGX",
          "Category",
          "Capital or running",
          "Tax treatment",
          "VAT",
          "Withholding tax",
          "Who",
          "Reference",
          "Payment ref",
          "Note",
        ],
        ...filtered.map((r) => {
          const rule = taxRule(r.category);
          return [
            r.entry_date,
            walletName(r.wallet_id),
            r.direction,
            r.amount_ugx,
            catLabel(r.category),
            r.direction === "in" ? (rule.income === "taxable" ? "Taxable income" : "Not income") : SPEND_LABEL[rule.spend],
            rule.treatment,
            rule.vat,
            rule.wht,
            r.counterparty_name,
            r.reference ?? "",
            r.transaction_id ? txns[r.transaction_id]?.txn_ref ?? "" : "",
            r.note ?? "",
          ];
        }),
      ])
    );
  };

  const activeRule = taxRule(category);

  return (
    <FinancePage
      title="Cashbook."
      lede="Every shilling in and out — dated, categorised, tied to the payment board and read against Ugandan tax."
      path="/app/finance/cashbook"
      actions={
        canLog ? (
          <>
            <button className={pill} onClick={() => setOpen("transfer")}>
              Move between wallets
            </button>
            <button className={solid} onClick={() => setOpen("entry")}>
              Log an entry
            </button>
          </>
        ) : null
      }
    >
      <section className="mb-10">
        <SectionHeading index="01" title="What's in the wallets" hint={`Total ${total.toLocaleString("en-UG")} UGX`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => (
            <div key={b.wallet_id} className="surface card-lift rounded-sm p-4">
              <div className="eyebrow text-ink-faint">{b.wallet_name}</div>
              <div className="display text-2xl mt-2">
                <Money amount={b.balance} />
              </div>
              <div className="mt-1 text-[11px] text-ink-soft">
                In {Number(b.money_in).toLocaleString("en-UG")} · Out {Number(b.money_out).toLocaleString("en-UG")}
              </div>
            </div>
          ))}
          {!balances.length && !loading && <p className="text-sm text-ink-soft">No wallets yet.</p>}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="02" title="This month at a glance" hint="Capital, running costs and income" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Money in", value: totals.inn, hint: `${totals.taxable.toLocaleString("en-UG")} taxable` },
            { label: "Money out", value: totals.out, hint: `${totals.neither.toLocaleString("en-UG")} not a cost` },
            { label: "Capital spend", value: totals.capex, hint: "Written off over years" },
            { label: "Running costs", value: totals.opex, hint: "Deducted this year" },
            { label: "Difference", value: totals.net, hint: "In minus out" },
          ].map((s) => (
            <div key={s.label} className="surface card-lift rounded-sm p-4">
              <div className="eyebrow text-ink-faint">{s.label}</div>
              <div className="display text-2xl mt-2">
                <Money amount={s.value} />
              </div>
              <div className="mt-1 text-[11px] text-ink-soft">{s.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading
          index="03"
          title="Entries"
          hint={`In ${totals.inn.toLocaleString("en-UG")} · Out ${totals.out.toLocaleString("en-UG")}`}
        />
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <label className="text-xs">
            <span className="eyebrow text-ink-faint">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
          </label>
          <SelectFilter
            label="Wallet"
            value={walletFilter}
            onChange={setWalletFilter}
            options={[{ value: "all", label: "All wallets" }, ...wallets.map((w) => ({ value: w.id, label: w.name }))]}
          />
          <SelectFilter
            label="Direction"
            value={dirFilter}
            onChange={setDirFilter}
            options={[
              { value: "all", label: "In and out" },
              { value: "in", label: "Money in" },
              { value: "out", label: "Money out" },
            ]}
          />
          <SelectFilter
            label="Kind of spend"
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { value: "all", label: "Everything" },
              { value: "capex", label: "Capital (capex)" },
              { value: "opex", label: "Running costs (opex)" },
              { value: "neither", label: "Not a cost" },
            ]}
          />
          <SelectFilter
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "all", label: "Any source" },
              { value: "board", label: "From the payment board" },
              { value: "manual", label: "Logged by hand" },
            ]}
          />
          <div className="min-w-[200px] flex-1">
            <SearchInput value={q} onChange={setQ} placeholder="Name, note, reference or payment ref" />
          </div>
          <button className={pill} onClick={exportCsv} disabled={!filtered.length}>
            Export
          </button>
        </div>

        <div className="rule-t">
          {filtered.map((r) => {
            const rule = taxRule(r.category);
            const txn = r.transaction_id ? txns[r.transaction_id] : undefined;
            return (
              <div key={r.id} className="rule-b py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="num text-xs text-ink-soft w-24">{dayLabel(r.entry_date)}</span>
                <span className="text-sm font-medium min-w-[140px]">{r.counterparty_name || "—"}</span>
                <StatusChip tone={r.direction === "in" ? "teal" : "amber"} value={r.direction === "in" ? "In" : "Out"} />
                <span className="text-xs text-ink-soft">{catLabel(r.category)}</span>
                {r.direction === "out" ? (
                  <StatusChip tone={spendTone(rule.spend)} value={spendChip(rule.spend)} />
                ) : (
                  <StatusChip
                    tone={rule.income === "taxable" ? "violet" : "neutral"}
                    value={rule.income === "taxable" ? "Taxable" : "Not income"}
                  />
                )}
                <span className="text-xs text-ink-faint">{walletName(r.wallet_id)}</span>
                {r.reference && <span className="text-[11px] text-ink-faint num">Ref {r.reference}</span>}
                {r.reverses_id && <StatusChip tone="stop" value="Reversal" />}
                <span className="ml-auto flex items-center gap-3">
                  <Money amount={r.direction === "in" ? r.amount_ugx : -r.amount_ugx} signed />
                  {r.attachment_path && (
                    <button className={pill} onClick={() => openReceipt(r.attachment_path as string)}>
                      Receipt
                    </button>
                  )}
                  {canLog && !r.reverses_id && (
                    <button className={pill} onClick={() => reverse(r)}>
                      Reverse
                    </button>
                  )}
                </span>
                {r.transaction_id && (
                  <p className="w-full text-[11px] text-ink-faint flex flex-wrap items-center gap-2">
                    <span className="eyebrow text-signal">Payment board</span>
                    <span className="num">{txn?.txn_ref ?? "Recorded payment"}</span>
                    {txn?.source_kind && <span>· {SOURCE_LABEL[txn.source_kind] ?? txn.source_kind}</span>}
                    {txn?.method && <span>· {txn.method}</span>}
                    {txn?.method_reference && <span className="num">· {txn.method_reference}</span>}
                    <Link to="/app/finance/payments" className="text-signal focus-ring">
                      Open the payment →
                    </Link>
                  </p>
                )}
                {r.note && <p className="w-full text-xs text-ink-soft">{r.note}</p>}
              </div>
            );
          })}
          {!filtered.length && <p className="py-6 text-sm text-ink-soft">Nothing recorded for this month yet.</p>}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading
          index="04"
          title="Tied to the payment board"
          hint={`${fromBoard.length} of ${filtered.length} entries`}
        />
        <div className="surface rounded-sm p-5 text-sm text-ink-soft">
          <p>
            Every payment recorded on the board lands here automatically, carrying its payment reference, method and
            what it settled — a cash request, a monthly run line or a loan. Anything else on this page was logged by
            hand.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span>
              <strong className="num text-ink">{Object.keys(txns).length}</strong> payments this month
            </span>
            <span>
              <strong className="num text-ink">{unlinkedTxns.length}</strong> not yet showing in the cashbook
            </span>
            <Link to="/app/finance/payments" className="eyebrow text-signal focus-ring">
              Open the payment board →
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="05" title="The tax view" hint="Uganda — capital, deductible, VAT and withholding" />
        {!taxRows.length ? (
          <p className="surface rounded-sm p-5 text-sm text-ink-soft">Log an entry and its tax treatment shows here.</p>
        ) : (
          <div className="rule-t">
            {taxRows.map((t) => {
              const rule = taxRule(t.cat);
              return (
                <div key={`${t.direction}:${t.cat}`} className="rule-b py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium">{catLabel(t.cat)}</span>
                    {t.direction === "out" ? (
                      <StatusChip tone={spendTone(rule.spend)} value={SPEND_LABEL[rule.spend]} />
                    ) : (
                      <StatusChip
                        tone={rule.income === "taxable" ? "violet" : "neutral"}
                        value={rule.income === "taxable" ? "Taxable income" : "Not taxable"}
                      />
                    )}
                    <span className="text-[11px] text-ink-faint">
                      {t.count} entr{t.count === 1 ? "y" : "ies"}
                    </span>
                    <span className="ml-auto">
                      <Money amount={t.direction === "in" ? t.total : -t.total} signed />
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-ink-soft">
                    <div>
                      <dt className="eyebrow text-ink-faint">Income tax</dt>
                      <dd className="mt-1">{rule.treatment}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-ink-faint">VAT</dt>
                      <dd className="mt-1">{rule.vat}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-ink-faint">Withholding tax</dt>
                      <dd className="mt-1">{rule.wht}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionHeading index="06" title="The rules, in plain English" hint="Why a category matters" />
        <div className="grid gap-3 md:grid-cols-2">
          {TAX_HEADLINES.map((h) => (
            <div key={h.title} className="surface rounded-sm p-5">
              <h3 className="text-sm font-semibold">{h.title}</h3>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">{h.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-ink-faint">{TAX_DISCLAIMER}</p>
      </section>

      {open === "entry" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(null)}>
          <div
            className="surface w-full max-w-lg rounded-sm p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SectionHeading index="—" title="Log an entry" />
            <div className="flex gap-2 mb-4">
              {(["out", "in"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDirection(d);
                    setCategory(d === "in" ? "client_payment" : "general");
                  }}
                  className={`press rounded-full border px-4 py-1.5 text-xs font-semibold focus-ring ${
                    direction === d ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised text-ink-soft"
                  }`}
                >
                  {d === "in" ? "Money in" : "Money out"}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Wallet</span>
                <select className={field} value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Amount (UGX)</span>
                <input className={field} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Date</span>
                <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Category</span>
                <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {direction === "in" ? (
                    INCOME_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {catLabel(c)}
                      </option>
                    ))
                  ) : (
                    <>
                      <optgroup label="Running costs (opex)">
                        {OPEX_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {catLabel(c)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Capital spend (capex)">
                        {CAPEX_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {catLabel(c)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Not a cost">
                        {NON_COST_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {catLabel(c)}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </label>
              <div className="sm:col-span-2 rounded-sm border border-rule bg-paper-sunken p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {direction === "out" ? (
                    <StatusChip tone={spendTone(activeRule.spend)} value={SPEND_LABEL[activeRule.spend]} />
                  ) : (
                    <StatusChip
                      tone={activeRule.income === "taxable" ? "violet" : "neutral"}
                      value={activeRule.income === "taxable" ? "Taxable income" : "Not taxable income"}
                    />
                  )}
                </div>
                <p className="mt-2 text-[11px] text-ink-soft leading-relaxed">{activeRule.treatment}</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  VAT: {activeRule.vat} · Withholding: {activeRule.wht}
                </p>
              </div>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">{direction === "in" ? "Received from" : "Paid to"}</span>
                <input className={field} value={who} onChange={(e) => setWho(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">They are a</span>
                <select className={field} value={whoKind} onChange={(e) => setWhoKind(e.target.value)}>
                  {COUNTERPARTY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {catLabel(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="eyebrow text-ink-faint">Belongs to (optional)</span>
                <select className={field} value={tagged} onChange={(e) => setTagged(e.target.value)}>
                  <option value="">Not tagged</option>
                  <optgroup label="Residents">
                    {residents.map((r) => (
                      <option key={r.id} value={`r:${r.id}`}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Projects">
                    {projects.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Reference — invoice, EFRIS or MoMo ID</span>
                <input className={field} value={reference} onChange={(e) => setReference(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Receipt (optional)</span>
                <input type="file" className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="eyebrow text-ink-faint">Note</span>
                <textarea className={field} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <p className="mt-3 text-[11px] text-ink-faint">
              Paying an approved request, a monthly run line or a loan? Record it on the payment board instead — it
              writes itself into the cashbook with its reference.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={pill} onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button className={solid} onClick={saveEntry} disabled={busy}>
                {busy ? "Saving…" : "Log it"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open === "transfer" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(null)}>
          <div className="surface w-full max-w-md rounded-sm p-6" onClick={(e) => e.stopPropagation()}>
            <SectionHeading index="—" title="Move between wallets" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">From</span>
                <select className={field} value={fromW} onChange={(e) => setFromW(e.target.value)}>
                  <option value="">Pick one</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">To</span>
                <select className={field} value={toW} onChange={(e) => setToW(e.target.value)}>
                  <option value="">Pick one</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Amount (UGX)</span>
                <input className={field} inputMode="numeric" value={tAmount} onChange={(e) => setTAmount(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="eyebrow text-ink-faint">Date</span>
                <input type="date" className={field} value={tDate} onChange={(e) => setTDate(e.target.value)} />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="eyebrow text-ink-faint">Note</span>
                <input className={field} value={tNote} onChange={(e) => setTNote(e.target.value)} />
              </label>
            </div>
            <p className="mt-3 text-[11px] text-ink-faint">
              A transfer is our own money changing hands. It is not income and not a cost, so it never touches tax.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={pill} onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button className={solid} onClick={saveTransfer} disabled={busy}>
                {busy ? "Saving…" : "Record it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FinancePage>
  );
}
