import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Money, StatusChip } from "@/components/system";
import { catLabel, csv, dayLabel, download, monthBounds, monthLabel, todayISO } from "@/lib/finance";
import {
  CATEGORY_REFERENCE,
  COMPANY_TAX_RATE,
  FILING_DISCLAIMER,
  FILING_GUIDE,
  VAT_KIND_LABEL,
  buildAnnualPack,
  buildVatReturn,
  whtCandidates,
  type CashRow,
} from "@/lib/tax";

type Tab = "vat" | "annual" | "guide";

const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring";
const on = "border-transparent bg-ink text-paper";

const ug = (n: number) => `UGX ${Math.round(n).toLocaleString("en-UG")}`;

export default function Filing() {
  const [tab, setTab] = useState<Tab>("vat");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [year, setYear] = useState(todayISO().slice(0, 4));
  const [monthRows, setMonthRows] = useState<CashRow[]>([]);
  const [yearRows, setYearRows] = useState<CashRow[]>([]);
  const [openBucket, setOpenBucket] = useState<string | null>(null);

  const cols =
    "id, direction, amount_ugx, entry_date, category, counterparty_name, counterparty_kind, reference, note, attachment_path";

  const load = useCallback(async () => {
    const { from, to } = monthBounds(month);
    const [m, y] = await Promise.all([
      supabase.from("cashbook_entries").select(cols).gte("entry_date", from).lt("entry_date", to).order("entry_date"),
      supabase
        .from("cashbook_entries")
        .select(cols)
        .gte("entry_date", `${year}-01-01`)
        .lte("entry_date", `${year}-12-31`)
        .order("entry_date"),
    ]);
    setMonthRows((m.data as CashRow[]) ?? []);
    setYearRows((y.data as CashRow[]) ?? []);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const vat = useMemo(() => buildVatReturn(monthRows, month), [monthRows, month]);
  const pack = useMemo(() => buildAnnualPack(yearRows, year), [yearRows, year]);
  const wht = useMemo(() => whtCandidates(monthRows), [monthRows]);

  /* ---------------- exports ---------------- */

  const exportCsv = () => {
    if (tab === "annual") {
      const rows: (string | number)[][] = [
        ["Site 99 — income tax working", year],
        [],
        ["Section", "Category", "Amount UGX", "Rate", "Allowance UGX", "Note"],
        ...pack.income.map((l) => ["Business income", l.label, l.amount, "", "", "Taxable"]),
        ...pack.deductible.map((l) => ["Deductible running cost", l.label, l.amount, "", "", ""]),
        ...pack.capital.map((c) => ["Capital item", c.label, c.amount, `${Math.round(c.rate * 100)}%`, c.allowance, c.basis]),
        ...pack.disallowed.map((l) => ["Not deductible", l.label, l.amount, "", "", l.why ?? ""]),
        [],
        ["Total income", "", pack.incomeTotal],
        ["Total deductible", "", pack.deductibleTotal],
        ["Capital allowances", "", pack.allowanceTotal],
        ["Chargeable profit", "", pack.profit],
        [`Company tax at ${Math.round(COMPANY_TAX_RATE * 100)}%`, "", pack.tax],
        [],
        ["Supporting entries"],
        ["Date", "In/Out", "Category", "Who", "Amount UGX", "Reference", "Invoice on file"],
        ...yearRows.map((r) => [
          r.entry_date,
          r.direction === "in" ? "In" : "Out",
          catLabel(r.category),
          r.counterparty_name,
          r.amount_ugx,
          r.reference ?? "",
          r.attachment_path ? "Yes" : "No",
        ]),
      ];
      download(`site99-income-tax-${year}.csv`, csv(rows));
      return;
    }
    const buckets = [vat.sales, vat.purchases, vat.imported, vat.blockedPurchases, vat.exemptSales];
    const rows: (string | number)[][] = [
      ["Site 99 — VAT return working", monthLabel(`${month}-01`)],
      [],
      ["Box", "Gross UGX", "VAT UGX"],
      ...buckets.map((b) => [b.label, b.gross, b.vat]),
      ["Output VAT", "", vat.outputVat],
      ["Reverse charge on imported services", "", vat.reverseCharge],
      ["Input VAT claimed", "", vat.inputVat],
      [vat.net >= 0 ? "VAT payable" : "VAT credit carried forward", "", Math.abs(vat.net)],
      [],
      ["Supporting entries"],
      ["Date", "In/Out", "Category", "VAT treatment", "Who", "Gross UGX", "Reference", "Invoice on file"],
      ...monthRows.map((r) => [
        r.entry_date,
        r.direction === "in" ? "In" : "Out",
        catLabel(r.category),
        VAT_KIND_LABEL[
          (buckets.find((b) => b.rows.some((x) => x.id === r.id))?.label === vat.imported.label
            ? "reverse_charge"
            : "standard") as "reverse_charge" | "standard"
        ],
        r.counterparty_name,
        r.amount_ugx,
        r.reference ?? "",
        r.attachment_path ? "Yes" : "No",
      ]),
    ];
    download(`site99-vat-${month}.csv`, csv(rows));
  };

  const exportPdf = () => {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const period = tab === "annual" ? `Year ended 31 December ${year}` : monthLabel(`${month}-01`);
    const title = tab === "annual" ? "Income tax return working" : "VAT return working";
    const rows = tab === "annual" ? yearRows : monthRows;

    const figures =
      tab === "annual"
        ? [
            ["Business income", pack.incomeTotal],
            ["Deductible running costs", -pack.deductibleTotal],
            ["Capital allowances", -pack.allowanceTotal],
            ["Chargeable profit", pack.profit],
            [`Company tax at ${Math.round(COMPANY_TAX_RATE * 100)}%`, pack.tax],
            ["Withholding tax suffered (credit)", -pack.whtSuffered],
          ]
        : [
            ["Standard rated sales (gross)", vat.sales.gross],
            ["Output VAT at 18%", vat.outputVat],
            ["Reverse charge on imported services", vat.reverseCharge],
            ["Purchases with a valid invoice (gross)", vat.purchases.gross],
            ["Input VAT claimed", -vat.inputVat],
            [vat.net >= 0 ? "VAT payable to URA" : "VAT credit carried forward", Math.abs(vat.net)],
          ];

    const schedule =
      tab === "annual"
        ? [
            ...pack.income.map((l) => ["Business income", l.label, l.amount, ""]),
            ...pack.deductible.map((l) => ["Deductible cost", l.label, l.amount, ""]),
            ...pack.capital.map((c) => [
              "Capital item",
              c.label,
              c.amount,
              `${Math.round(c.rate * 100)}% → ${ug(c.allowance)} allowance`,
            ]),
            ...pack.disallowed.map((l) => ["Not deductible", l.label, l.amount, l.why ?? ""]),
          ]
        : [
            ["Sales", vat.sales.label, vat.sales.gross, ug(vat.sales.vat) + " VAT"],
            ["Purchases", vat.purchases.label, vat.purchases.gross, ug(vat.purchases.vat) + " VAT"],
            ["Imported services", vat.imported.label, vat.imported.gross, ug(vat.imported.vat) + " reverse charge"],
            ["No invoice", vat.blockedPurchases.label, vat.blockedPurchases.gross, "No input VAT claimed"],
            ["Exempt / outside", vat.exemptSales.label, vat.exemptSales.gross, "No VAT"],
          ];

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Site 99 — ${esc(title)} — ${esc(period)}</title>
<style>
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { font: 12px/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; margin: 28px 0 8px; color: #555; }
.meta { color: #666; font-size: 11px; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #666; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.total td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
.note { margin-top: 24px; padding: 10px 12px; background: #f6f6f6; border-left: 3px solid #111; font-size: 11px; color: #444; }
.sign { margin-top: 28px; display: flex; gap: 40px; font-size: 11px; color: #444; }
.sign div { flex: 1; border-top: 1px solid #999; padding-top: 6px; }
tfoot td { font-weight: 700; }
</style></head><body>
<h1>Site 99 — ${esc(title)}</h1>
<div class="meta">${esc(period)} · prepared ${esc(dayLabel(todayISO()))} · all amounts in Uganda Shillings</div>

<h2>As submitted</h2>
<table><tbody>
${figures
  .map(
    ([l, v]) =>
      `<tr${String(l).startsWith("Chargeable") || String(l).startsWith("VAT payable") || String(l).startsWith("VAT credit") ? ' class="total"' : ""}><td>${esc(l)}</td><td class="n">${esc(ug(Number(v)))}</td></tr>`
  )
  .join("")}
</tbody></table>

<h2>How it was worked out</h2>
<table><thead><tr><th>Section</th><th>Line</th><th class="n">Amount</th><th>Note</th></tr></thead><tbody>
${schedule.map((s) => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td class="n">${esc(ug(Number(s[2])))}</td><td>${esc(s[3])}</td></tr>`).join("")}
</tbody></table>

<h2>Supporting entries (${rows.length})</h2>
<table><thead><tr><th>Date</th><th>In/Out</th><th>Category</th><th>Who</th><th class="n">Amount</th><th>Reference</th><th>Invoice</th></tr></thead><tbody>
${rows
  .map(
    (r) =>
      `<tr><td>${esc(r.entry_date)}</td><td>${r.direction === "in" ? "In" : "Out"}</td><td>${esc(catLabel(r.category))}</td><td>${esc(r.counterparty_name)}</td><td class="n">${esc(ug(r.amount_ugx))}</td><td>${esc(r.reference ?? "—")}</td><td>${r.attachment_path ? "Yes" : "No"}</td></tr>`
  )
  .join("")}
</tbody></table>

<div class="note">${esc(FILING_DISCLAIMER)}</div>
<div class="sign"><div>Prepared by</div><div>Reviewed by accountant</div><div>Approved by director</div></div>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  /* ---------------- view ---------------- */

  const bucketRow = (b: { label: string; gross: number; vat: number; rows: CashRow[]; hint: string }) => (
    <div key={b.label} className="surface rounded-2xl">
      <button
        className="w-full px-4 py-3 text-left flex flex-wrap items-center gap-3 focus-ring"
        onClick={() => setOpenBucket(openBucket === b.label ? null : b.label)}
      >
        <span className="font-medium">{b.label}</span>
        <span className="text-xs text-ink-faint">{b.hint}</span>
        <span className="ml-auto text-sm text-ink-soft">{b.rows.length} entries</span>
        <Money amount={b.gross} className="font-semibold" />
        {!!b.vat && <StatusChip tone="violet" value={`${ug(b.vat)} VAT`} />}
      </button>
      {openBucket === b.label && (
        <ul className="divide-y divide-rule border-t border-rule">
          {b.rows.map((r) => (
            <li key={r.id} className="px-4 py-2 text-sm flex flex-wrap items-center gap-3">
              <span className="text-ink-faint">{dayLabel(r.entry_date)}</span>
              <span>{r.counterparty_name}</span>
              <span className="text-ink-soft">{catLabel(r.category)}</span>
              {!r.attachment_path && <StatusChip tone="warn" value="No invoice" />}
              <Money amount={r.amount_ugx} className="ml-auto" />
            </li>
          ))}
          {!b.rows.length && <li className="px-4 py-2 text-sm text-ink-soft">Nothing here this month.</li>}
        </ul>
      )}
    </div>
  );

  return (
    <FinancePage
      title="Filing"
      lede="The VAT return and the income tax working, built from the cashbook and ready for the accountant."
      path="/app/finance/filing"
      actions={
        <div className="flex flex-wrap gap-2">
          {tab !== "guide" && (
            <>
              <button className={pill} onClick={exportCsv}>
                Data file (CSV)
              </button>
              <button className="ctl ctl-solid eyebrow px-4 py-2 focus-ring" onClick={exportPdf}>
                Filing pack (PDF)
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <button className={`${pill} ${tab === "vat" ? on : ""}`} onClick={() => setTab("vat")}>
          Monthly VAT
        </button>
        <button className={`${pill} ${tab === "annual" ? on : ""}`} onClick={() => setTab("annual")}>
          Annual income tax
        </button>
        <button className={`${pill} ${tab === "guide" ? on : ""}`} onClick={() => setTab("guide")}>
          How tax works for us
        </button>
        <span className="ml-auto" />
        {tab === "vat" && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-rule bg-paper-raised px-3 py-1.5 text-sm focus-ring"
          />
        )}
        {tab === "annual" && (
          <input
            type="number"
            value={year}
            min={2020}
            max={2100}
            onChange={(e) => setYear(e.target.value)}
            className="w-28 rounded-lg border border-rule bg-paper-raised px-3 py-1.5 text-sm focus-ring"
          />
        )}
      </div>

      {tab === "vat" && (
        <div className="space-y-10">
          <div>
            <SectionHeading index="01" title="The return" hint={`Due by 15 ${monthLabel(vat.dueOn)}`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Output VAT on sales", value: vat.outputVat },
                { label: "Reverse charge (imports)", value: vat.reverseCharge },
                { label: "Input VAT claimed", value: vat.inputVat },
                { label: vat.net >= 0 ? "VAT payable" : "VAT credit", value: Math.abs(vat.net) },
              ].map((f) => (
                <div key={f.label} className="surface rounded-2xl p-4">
                  <div className="eyebrow text-ink-faint">{f.label}</div>
                  <Money amount={f.value} className="text-2xl font-semibold" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading index="02" title="Every box, and what is behind it" hint="Tap a line to see the entries" />
            <div className="space-y-3">
              {[vat.sales, vat.exemptSales, vat.purchases, vat.blockedPurchases, vat.imported].map(bucketRow)}
            </div>
          </div>

          <div>
            <SectionHeading index="03" title="Withholding tax to check" hint="Payments of UGX 1,000,000 or more" />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {wht.map(({ row, withhold }) => (
                <li key={row.id} className="px-4 py-3 text-sm flex flex-wrap items-center gap-3">
                  <span className="text-ink-faint">{dayLabel(row.entry_date)}</span>
                  <span className="font-medium">{row.counterparty_name}</span>
                  <span className="text-ink-soft">{catLabel(row.category)}</span>
                  <Money amount={row.amount_ugx} className="ml-auto" />
                  <StatusChip tone="amber" value={`Withhold 6% — ${ug(withhold)}`} />
                </li>
              ))}
              {!wht.length && <li className="px-4 py-3 text-sm text-ink-soft">Nothing crossed the threshold this month.</li>}
            </ul>
          </div>

          <p className="surface rounded-sm p-5 text-sm text-ink-soft">{FILING_DISCLAIMER}</p>
        </div>
      )}

      {tab === "annual" && (
        <div className="space-y-10">
          <div>
            <SectionHeading index="01" title={`Year ${year}`} hint="Profit and the tax on it" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Business income", value: pack.incomeTotal },
                { label: "Deductible costs", value: pack.deductibleTotal },
                { label: "Capital allowances", value: pack.allowanceTotal },
                { label: "Company tax at 30%", value: pack.tax },
              ].map((f) => (
                <div key={f.label} className="surface rounded-2xl p-4">
                  <div className="eyebrow text-ink-faint">{f.label}</div>
                  <Money amount={f.value} className="text-2xl font-semibold" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Chargeable profit <Money amount={pack.profit} className="font-semibold" />
              {pack.turnoverFlag && " · turnover has passed UGX 150m, so VAT registration is compulsory."}
            </p>
          </div>

          <div>
            <SectionHeading index="02" title="Income" hint="Taxable business income" />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {pack.income.map((l) => (
                <li key={l.category} className="px-4 py-3 flex items-center gap-3">
                  <span>{l.label}</span>
                  <span className="text-xs text-ink-faint">{l.rows.length} entries</span>
                  <Money amount={l.amount} className="ml-auto font-semibold" />
                </li>
              ))}
              {!pack.income.length && <li className="px-4 py-3 text-sm text-ink-soft">No income logged for this year yet.</li>}
            </ul>
          </div>

          <div>
            <SectionHeading index="03" title="Running costs we can deduct" hint="Come off profit in full" />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {pack.deductible.map((l) => (
                <li key={l.category} className="px-4 py-3 flex items-center gap-3">
                  <span>{l.label}</span>
                  <span className="text-xs text-ink-faint">{l.rows.length} entries</span>
                  <Money amount={l.amount} className="ml-auto font-semibold" />
                </li>
              ))}
              {!pack.deductible.length && <li className="px-4 py-3 text-sm text-ink-soft">Nothing yet.</li>}
            </ul>
          </div>

          <div>
            <SectionHeading index="04" title="Capital items" hint="Written off over time" />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {pack.capital.map((c) => (
                <li key={c.category} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs text-ink-faint">{c.basis}</span>
                  <Money amount={c.amount} className="ml-auto" />
                  <StatusChip tone="teal" value={`Allowance ${ug(c.allowance)}`} />
                </li>
              ))}
              {!pack.capital.length && <li className="px-4 py-3 text-sm text-ink-soft">No capital spending this year.</li>}
            </ul>
          </div>

          <div>
            <SectionHeading index="05" title="Not deductible" hint="Kept out of the tax working" />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {pack.disallowed.map((l) => (
                <li key={l.category} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-sm text-ink-soft">{l.why}</span>
                  <Money amount={l.amount} className="ml-auto" />
                </li>
              ))}
              {!pack.disallowed.length && <li className="px-4 py-3 text-sm text-ink-soft">Nothing disallowed this year.</li>}
            </ul>
          </div>

          <p className="surface rounded-sm p-5 text-sm text-ink-soft">{FILING_DISCLAIMER}</p>
        </div>
      )}

      {tab === "guide" && (
        <div className="space-y-10">
          <div>
            <SectionHeading index="01" title="How tax works for us" hint="Uganda — plain English" />
            <div className="grid gap-4 md:grid-cols-2">
              {FILING_GUIDE.map((g) => (
                <article key={g.title} className="surface rounded-2xl p-5">
                  <h3 className="font-semibold">{g.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft">{g.body}</p>
                  {g.points && (
                    <ul className="mt-3 space-y-1.5 text-sm text-ink-soft list-disc pl-5">
                      {g.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading index="02" title="Every category and its treatment" hint="What to pick when logging" />
            <div className="surface rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-ink-faint">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Income tax</th>
                    <th className="px-4 py-3">VAT</th>
                    <th className="px-4 py-3">Withholding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {CATEGORY_REFERENCE.map((c) => (
                    <tr key={c.category} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.label}</div>
                        <StatusChip
                          className="mt-1"
                          tone={c.spend === "capex" ? "blue" : c.spend === "neither" ? "neutral" : "teal"}
                          value={c.spend === "capex" ? "Capital" : c.spend === "neither" ? "Not a cost" : "Running cost"}
                        />
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{c.treatment}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        <div className="eyebrow text-ink-faint">{VAT_KIND_LABEL[c.vatKind]}</div>
                        {c.vat}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{c.wht}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="surface rounded-sm p-5 text-sm text-ink-soft">{FILING_DISCLAIMER}</p>
        </div>
      )}
    </FinancePage>
  );
}
