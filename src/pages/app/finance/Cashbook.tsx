import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Money, SearchInput, SelectFilter, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  COUNTERPARTY_KINDS,
  catLabel,
  csv,
  dayLabel,
  download,
  monthBounds,
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
type Resident = { id: string; name: string };
type Project = { id: string; title: string };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";

export default function Cashbook() {
  const { canSeeFinance, has } = useMyRoles();
  const canLog = canSeeFinance || has("admin", "founder");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [walletFilter, setWalletFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all");
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
    const [w, b, e, r, p] = await Promise.all([
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
    ]);
    setWallets((w.data as Wallet[]) ?? []);
    setBalances((b.data as Balance[]) ?? []);
    setRows((e.data as Entry[]) ?? []);
    setResidents(((r.data as Resident[]) ?? []).map((x) => ({ id: x.id, name: x.name })));
    setProjects((p.data as Project[]) ?? []);
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
      if (!needle) return true;
      return [r.counterparty_name, r.note, r.reference, r.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, walletFilter, dirFilter, q]);

  const totals = useMemo(() => {
    let inn = 0;
    let out = 0;
    filtered.forEach((r) => (r.direction === "in" ? (inn += r.amount_ugx) : (out += r.amount_ugx)));
    return { inn, out, net: inn - out };
  }, [filtered]);

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
        ["Date", "Wallet", "In/Out", "Amount UGX", "Category", "Who", "Reference", "Note"],
        ...filtered.map((r) => [
          r.entry_date,
          walletName(r.wallet_id),
          r.direction,
          r.amount_ugx,
          r.category,
          r.counterparty_name,
          r.reference ?? "",
          r.note ?? "",
        ]),
      ])
    );
  };

  const categories = direction === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <FinancePage
      title="Cashbook."
      lede="Every shilling in and out, wallet by wallet."
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

      <section>
        <SectionHeading
          index="02"
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
          <div className="min-w-[200px] flex-1">
            <SearchInput value={q} onChange={setQ} placeholder="Name, note or reference" />
          </div>
          <button className={pill} onClick={exportCsv} disabled={!filtered.length}>
            Export
          </button>
        </div>

        <div className="rule-t">
          {filtered.map((r) => (
            <div key={r.id} className="rule-b py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="num text-xs text-ink-soft w-24">{dayLabel(r.entry_date)}</span>
              <span className="text-sm font-medium min-w-[140px]">{r.counterparty_name || "—"}</span>
              <StatusChip tone={r.direction === "in" ? "teal" : "amber"} label={r.direction === "in" ? "In" : "Out"} />
              <span className="text-xs text-ink-soft">{catLabel(r.category)}</span>
              <span className="text-xs text-ink-faint">{walletName(r.wallet_id)}</span>
              {r.reverses_id && <StatusChip tone="stop" label="Reversal" />}
              {r.transaction_id && <span className="text-[11px] text-ink-faint">From a payment</span>}
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
              {r.note && <p className="w-full text-xs text-ink-soft">{r.note}</p>}
            </div>
          ))}
          {!filtered.length && (
            <p className="py-6 text-sm text-ink-soft">Nothing recorded for this month yet.</p>
          )}
        </div>
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
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {catLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
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
                <span className="eyebrow text-ink-faint">Reference (optional)</span>
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
