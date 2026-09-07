import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  METRIC_COLUMNS,
  lastCompletedWeek,
  monthLabel,
  monthOfWeek,
  weekEnd,
  weekLabel,
  type MetricKey,
} from "@/lib/weeks";
import { ArrowUpRight, Download, TrendingDown, TrendingUp } from "lucide-react";

type ResidentOpt = { id: string; name: string; territory: string; contact_user_id: string | null; handler_user_id: string | null };
type Account = { id: string; resident_id: string; platform: string; handle: string; active: boolean; sort: number };
type MetricRow = {
  id: string;
  account_id: string;
  week_start: string;
  followers: number | null;
  profile_visits: number | null;
  reach: number | null;
  impressions: number | null;
  posts: number | null;
  link_clicks: number | null;
};

type Draft = Record<MetricKey, string>;
const emptyDraft = (): Draft =>
  METRIC_COLUMNS.reduce((a, c) => ({ ...a, [c.key]: "" }), {} as Draft);

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString());

export default function Clients() {
  const { userId, isLeadership } = useMyRoles();
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<ResidentOpt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);

  const [entry, setEntry] = useState<{ account: Account; week: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Account | null>(null);
  const [historyView, setHistoryView] = useState<"weeks" | "months">("weeks");

  const week = lastCompletedWeek();

  const load = async () => {
    const [{ data: rs }, { data: acc }] = await Promise.all([
      supabase.rpc("resident_options"),
      supabase.from("client_accounts").select("*").order("sort", { ascending: true }),
    ]);
    const accountsList = ((acc as unknown as Account[]) ?? []).slice();
    setResidents((rs as unknown as ResidentOpt[]) ?? []);
    setAccounts(accountsList);
    if (accountsList.length) {
      const { data: m } = await supabase
        .from("account_metrics")
        .select("id, account_id, week_start, followers, profile_visits, reach, impressions, posts, link_clicks")
        .in("account_id", accountsList.map((a) => a.id))
        .order("week_start", { ascending: false });
      setMetrics((m as unknown as MetricRow[]) ?? []);
    } else {
      setMetrics([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const byAccount = useMemo(() => {
    const m = new Map<string, MetricRow[]>();
    metrics.forEach((row) => {
      const list = m.get(row.account_id) ?? [];
      list.push(row);
      m.set(row.account_id, list);
    });
    m.forEach((list) => list.sort((a, b) => b.week_start.localeCompare(a.week_start)));
    return m;
  }, [metrics]);

  const canFill = (a: Account) => {
    const r = resById.get(a.resident_id);
    return isLeadership || r?.contact_user_id === userId || r?.handler_user_id === userId;
  };

  const pending = useMemo(
    () =>
      accounts.filter(
        (a) => a.active && canFill(a) && !(byAccount.get(a.id) ?? []).some((m) => m.week_start === week)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, byAccount, week, residents, userId, isLeadership]
  );

  const groups = useMemo(() => {
    const ids = Array.from(new Set(accounts.map((a) => a.resident_id)));
    return ids
      .map((id) => ({
        resident: resById.get(id),
        id,
        accounts: accounts.filter((a) => a.resident_id === id),
      }))
      .sort((a, b) => (a.resident?.name ?? "").localeCompare(b.resident?.name ?? ""));
  }, [accounts, resById]);

  const openEntry = (account: Account, w: string) => {
    const existing = (byAccount.get(account.id) ?? []).find((m) => m.week_start === w);
    const d = emptyDraft();
    if (existing) {
      METRIC_COLUMNS.forEach((c) => {
        const v = existing[c.key];
        d[c.key] = v === null || v === undefined ? "" : String(v);
      });
    }
    setDraft(d);
    setEntry({ account, week: w });
  };

  const saveEntry = async () => {
    if (!entry) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      account_id: entry.account.id,
      week_start: entry.week,
      filled_by: userId,
      filled_at: new Date().toISOString(),
    };
    METRIC_COLUMNS.forEach((c) => {
      const raw = draft[c.key].trim();
      payload[c.key] = raw === "" ? null : Number(raw.replace(/[^\d.-]/g, ""));
    });
    const { error } = await supabase
      .from("account_metrics")
      .upsert(payload as never, { onConflict: "account_id,week_start" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Week saved");
    setEntry(null);
    load();
  };

  const latestPair = (id: string) => {
    const list = byAccount.get(id) ?? [];
    return { latest: list[0], previous: list[1] };
  };

  const historyRows = history ? byAccount.get(history.id) ?? [] : [];

  const monthRows = useMemo(() => {
    const map = new Map<string, MetricRow[]>();
    historyRows.forEach((r) => {
      const k = monthOfWeek(r.week_start);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, rows]) => {
        const sorted = rows.slice().sort((a, b) => a.week_start.localeCompare(b.week_start));
        const sum = (k: MetricKey) =>
          sorted.reduce<number | null>((acc, r) => (r[k] === null ? acc : (acc ?? 0) + (r[k] as number)), null);
        const first = sorted.find((r) => r.followers !== null)?.followers ?? null;
        const last = [...sorted].reverse().find((r) => r.followers !== null)?.followers ?? null;
        return {
          month,
          weeks: sorted.length,
          followers: last,
          gain: first !== null && last !== null ? last - first : null,
          profile_visits: sum("profile_visits"),
          reach: sum("reach"),
          impressions: sum("impressions"),
          posts: sum("posts"),
          link_clicks: sum("link_clicks"),
        };
      });
  }, [historyRows]);

  const exportCsv = () => {
    if (!history) return;
    const head = ["Week ending", ...METRIC_COLUMNS.map((c) => c.label)];
    const lines = [head.join(",")].concat(
      historyRows
        .slice()
        .sort((a, b) => a.week_start.localeCompare(b.week_start))
        .map((r) => [weekEnd(r.week_start), ...METRIC_COLUMNS.map((c) => r[c.key] ?? "")].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resById.get(history.resident_id)?.name ?? "client"}-${history.platform}-weekly.csv`
      .replace(/\s+/g, "-")
      .toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell eyebrow="Client relations">
      <Seo
        title="Client relations — Site 99"
        description="Every account we manage and its weekly numbers."
        path="/app/clients"
        noindex
      />
      <PageHeader
        eyebrow="Client relations"
        title="Accounts."
        lede="Every social account we manage, with its numbers filled in once a week — so month-end reports write themselves."
      />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-12">
              <SectionHeading
                index="00"
                title={`Numbers for ${weekLabel(week)}`}
                hint={`${pending.length} still to fill`}
              />
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {pending.map((a) => (
                  <li key={a.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold">{resById.get(a.resident_id)?.name ?? "—"}</span>
                    <StatusChip value={a.platform} tone="violet" />
                    <span className="text-xs text-ink-faint truncate">{a.handle}</span>
                    <Button size="sm" className="ml-auto" onClick={() => openEntry(a, week)}>
                      Add the week
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SectionHeading index="01" title="Clients" hint={`${groups.length} with accounts`} />
          {groups.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No accounts set up yet. Founders and management add them on the client record in Site editing → Residents.
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.id} className="surface rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 flex items-baseline gap-3 border-b border-rule">
                    <div className="display text-lg">{g.resident?.name ?? "Unknown client"}</div>
                    <div className="text-xs text-ink-faint">{g.resident?.territory}</div>
                  </div>
                  <ul className="divide-y divide-rule">
                    {g.accounts.map((a) => {
                      const { latest, previous } = latestPair(a.id);
                      const delta =
                        latest?.followers != null && previous?.followers != null
                          ? latest.followers - previous.followers
                          : null;
                      return (
                        <li key={a.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                          <StatusChip value={a.platform} tone={a.active ? "teal" : "neutral"} />
                          <span className="text-sm truncate">{a.handle || "—"}</span>
                          {!a.active && <span className="text-[11px] text-ink-faint">no longer managed</span>}
                          <span className="ml-auto num text-sm">
                            {num(latest?.followers)} <span className="text-[11px] text-ink-faint">followers</span>
                          </span>
                          {delta !== null && (
                            <span
                              className={`inline-flex items-center gap-1 num text-[11px] ${
                                delta >= 0 ? "text-acc-teal" : "text-signal"
                              }`}
                            >
                              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {delta >= 0 ? "+" : ""}
                              {delta.toLocaleString()}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setHistoryView("weeks");
                              setHistory(a);
                            }}
                          >
                            History
                          </Button>
                          {canFill(a) && (
                            <Button size="sm" variant="soft" onClick={() => openEntry(a, week)}>
                              {(byAccount.get(a.id) ?? []).some((m) => m.week_start === week) ? "Edit week" : "Add week"}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Weekly entry */}
      <Dialog open={!!entry} onOpenChange={(o) => !o && setEntry(null)}>
        <DialogContent className="max-w-lg bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {entry ? `${entry.account.platform} — ${resById.get(entry.account.resident_id)?.name ?? ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-ink-faint -mt-2">
            Week of {entry ? weekLabel(entry.week) : ""} · leave blank anything the platform doesn't report.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {METRIC_COLUMNS.map((c) => (
              <div key={c.key}>
                <label className="eyebrow text-[10px] text-ink-faint">{c.label}</label>
                <input
                  className="field mt-1 text-sm num"
                  inputMode="numeric"
                  value={draft[c.key]}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="mt-2 flex items-center gap-2">
            <Button variant="ghost" onClick={() => setEntry(null)}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? "Saving…" : "Save week"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {history ? `${history.platform} — ${resById.get(history.resident_id)?.name ?? ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={historyView === "weeks" ? "default" : "outline"}
              onClick={() => setHistoryView("weeks")}
            >
              By week
            </Button>
            <Button
              size="sm"
              variant={historyView === "months" ? "default" : "outline"}
              onClick={() => setHistoryView("months")}
            >
              By month
            </Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>

          {historyRows.length === 0 ? (
            <p className="text-sm text-ink-soft">No weeks recorded yet.</p>
          ) : historyView === "weeks" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-[10px] text-ink-faint border-b border-rule">
                    <th className="py-2 pr-3">Week ending</th>
                    {METRIC_COLUMNS.map((c) => (
                      <th key={c.key} className="py-2 px-3 text-right whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                    <th className="py-2 pl-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {historyRows.map((r, i) => {
                    const prev = historyRows[i + 1];
                    const delta =
                      r.followers != null && prev?.followers != null ? r.followers - prev.followers : null;
                    return (
                      <tr key={r.id}>
                        <td className="py-2 pr-3 num text-[12px] whitespace-nowrap">{weekEnd(r.week_start)}</td>
                        {METRIC_COLUMNS.map((c) => (
                          <td key={c.key} className="py-2 px-3 num text-right">
                            {num(r[c.key])}
                          </td>
                        ))}
                        <td
                          className={`py-2 pl-3 num text-right ${
                            delta === null ? "text-ink-faint" : delta >= 0 ? "text-acc-teal" : "text-signal"
                          }`}
                        >
                          {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toLocaleString()}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-[10px] text-ink-faint border-b border-rule">
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 px-3 text-right">Weeks</th>
                    <th className="py-2 px-3 text-right">Followers</th>
                    <th className="py-2 px-3 text-right">Net gain</th>
                    <th className="py-2 px-3 text-right">Visits</th>
                    <th className="py-2 px-3 text-right">Reach</th>
                    <th className="py-2 px-3 text-right">Impressions</th>
                    <th className="py-2 px-3 text-right">Posts</th>
                    <th className="py-2 pl-3 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {monthRows.map((m) => (
                    <tr key={m.month}>
                      <td className="py-2 pr-3 whitespace-nowrap">{monthLabel(m.month)}</td>
                      <td className="py-2 px-3 num text-right">{m.weeks}</td>
                      <td className="py-2 px-3 num text-right">{num(m.followers)}</td>
                      <td
                        className={`py-2 px-3 num text-right ${
                          m.gain === null ? "text-ink-faint" : m.gain >= 0 ? "text-acc-teal" : "text-signal"
                        }`}
                      >
                        {m.gain === null ? "—" : `${m.gain >= 0 ? "+" : ""}${m.gain.toLocaleString()}`}
                      </td>
                      <td className="py-2 px-3 num text-right">{num(m.profile_visits)}</td>
                      <td className="py-2 px-3 num text-right">{num(m.reach)}</td>
                      <td className="py-2 px-3 num text-right">{num(m.impressions)}</td>
                      <td className="py-2 px-3 num text-right">{num(m.posts)}</td>
                      <td className="py-2 pl-3 num text-right">{num(m.link_clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history && canFill(history) && (
            <DialogFooter className="mt-2">
              <Button variant="ghost" onClick={() => setHistory(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const a = history;
                  setHistory(null);
                  openEntry(a, week);
                }}
              >
                <ArrowUpRight className="h-4 w-4" /> Fill this week
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
