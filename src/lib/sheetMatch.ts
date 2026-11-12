export type SheetLine = { id: string; entry_date: string | null; direction: "in" | "out"; amount: number; description: string | null; system_id: string | null };
export type AppLine = { id: string; entry_date: string; direction: string; amount_ugx: number; counterparty_name: string; doc_number: string | null };
export type MatchResult = {
  matched: { sheet: SheetLine; app: AppLine; dateNote: string | null }[];
  sheetOnly: SheetLine[];
  appOnly: AppLine[];
};

const days = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
/** 2026-11-03 written as 2026-03-11: day and month swapped. */
const swapped = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4) && a.slice(5, 7) === b.slice(8, 10) && a.slice(8, 10) === b.slice(5, 7);

/** Pairs each old-sheet line with an app entry of the same direction and amount, closest date first (within 5 days, or day/month swapped). */
export function matchSheetToApp(sheet: SheetLine[], app: AppLine[]): MatchResult {
  const free = new Set(app.map((a) => a.id));
  const matched: MatchResult["matched"] = [];
  const sheetOnly: SheetLine[] = [];
  for (const s of sheet) {
    if (!s.amount || !s.entry_date) { sheetOnly.push(s); continue; }
    const cands = app.filter((a) => free.has(a.id) && a.direction === s.direction && a.amount_ugx === s.amount)
      .map((a) => ({ a, d: days(a.entry_date, s.entry_date as string), sw: swapped(a.entry_date, s.entry_date as string) }))
      .filter((c) => c.d <= 5 || c.sw)
      .sort((x, y) => (x.sw ? 0 : x.d) - (y.sw ? 0 : y.d));
    const best = cands[0];
    if (!best) { sheetOnly.push(s); continue; }
    free.delete(best.a.id);
    const dateNote = best.a.entry_date === s.entry_date ? null
      : best.sw && best.d > 5 ? `Day and month swapped in the app (${best.a.entry_date}, should be ${s.entry_date})`
      : `Date differs: sheet ${s.entry_date}, app ${best.a.entry_date}`;
    matched.push({ sheet: s, app: best.a, dateNote });
  }
  return { matched, sheetOnly, appOnly: app.filter((a) => free.has(a.id)) };
}
