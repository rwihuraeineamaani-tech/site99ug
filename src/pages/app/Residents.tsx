import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip, SearchInput, SelectFilter, FilterBar } from "@/components/system";
import AccountsPanel from "@/components/system/AccountsPanel";
import ClientPayPanel from "@/components/system/ClientPayPanel";
import PortalAccessPanel from "@/components/residents/PortalAccessPanel";
import { useMyRoles } from "@/hooks/useMyRoles";
import { logoUrls, initials } from "@/lib/logo";
import { ChevronRight, LayoutGrid, Rows3, CalendarClock, Camera, Clapperboard, UserRound, Wallet } from "lucide-react";
import { clientTone } from "@/lib/contractLifecycle";
import ClientLifecycleSwitch from "@/components/residents/ClientLifecycleSwitch";
import AddResidentDialog from "@/components/residents/AddResidentDialog";

export type ResidentRecord = {
  id: string;
  name: string;
  territory: string | null;
  since: string | null;
  status: string | null;
  email: string | null;
  user_id: string | null;
  avatar_url: string | null;
  contact_user_id: string | null;
  handler_user_id: string | null;
  notes: string | null;
  onboarding_status?: string | null;
  archived_at?: string | null;
};

const VIEW_KEY = "site99:residents-view";

type Summary = {
  handler: string | null;
  endsOn: string | null;
  accounts: number;
  moving: number;
  nextShoot: string | null;
  owed: number;
  contract: boolean;
};

const LIVE = new Set(["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover"]);
const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

export default function ResidentsHub() {
  const { userId, canSeeFinance, has } = useMyRoles();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ResidentRecord[]>([]);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [sum, setSum] = useState<Record<string, Summary>>({});
  const [tab, setTab] = useState<"clients" | "accounts" | "lifecycle">("clients");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<"cards" | "list">(
    () => (localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards")
  );

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: res }, { data: acc }, { data: content }, { data: contracts }, { data: team }, { data: shoots }, { data: inv }] = await Promise.all([
        supabase.from("residents").select("id,name,territory,since,status,email,user_id,avatar_url,contact_user_id,handler_user_id,notes,onboarding_status,archived_at").order("name"),
        supabase.from("client_accounts").select("resident_id, active"),
        supabase.from("content_items").select("resident_id, stage"),
        supabase.from("resident_contracts").select("resident_id, status, ends_on"),
        supabase.from("team_members").select("user_id, display_name, email"),
        supabase.from("shoot_days").select("resident_id, shoot_date").gte("shoot_date", today).order("shoot_date"),
        canSeeFinance
          ? supabase.from("invoices").select("resident_id, total_ugx, amount_paid_ugx, status")
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      const people = (res as unknown as ResidentRecord[]) ?? [];
      setRows(people);
      logoUrls(people.map((p) => ({ id: p.id, avatar_url: p.avatar_url }))).then(setLogos);

      const names = new Map(((team as { user_id: string; display_name: string | null; email: string }[]) ?? []).map((m) => [m.user_id, m.display_name || m.email]));
      const s: Record<string, Summary> = {};
      people.forEach((p) => {
        s[p.id] = { handler: p.handler_user_id ? names.get(p.handler_user_id) ?? null : null, endsOn: null, accounts: 0, moving: 0, nextShoot: null, owed: 0, contract: false };
      });
      ((acc as { resident_id: string; active: boolean }[]) ?? []).forEach((r) => {
        if (r.active && s[r.resident_id]) s[r.resident_id].accounts++;
      });
      ((content as { resident_id: string | null; stage: string }[]) ?? []).forEach((r) => {
        if (r.resident_id && s[r.resident_id] && LIVE.has(r.stage)) s[r.resident_id].moving++;
      });
      ((contracts as { resident_id: string; status: string; ends_on: string | null }[]) ?? []).forEach((r) => {
        const x = s[r.resident_id];
        if (!x || !(r.status === "active" || r.status === "renewal_due")) return;
        x.contract = true;
        if (r.ends_on && (!x.endsOn || r.ends_on > x.endsOn)) x.endsOn = r.ends_on;
      });
      ((shoots as { resident_id: string | null; shoot_date: string | null }[]) ?? []).forEach((r) => {
        if (r.resident_id && s[r.resident_id] && !s[r.resident_id].nextShoot && r.shoot_date) s[r.resident_id].nextShoot = r.shoot_date;
      });
      ((inv as { resident_id: string | null; total_ugx: number | null; amount_paid_ugx: number | null; status: string }[]) ?? []).forEach((r) => {
        if (!r.resident_id || !s[r.resident_id] || r.status === "cancelled" || r.status === "void" || r.status === "draft") return;
        s[r.resident_id].owed += Math.max(0, (r.total_ugx ?? 0) - (r.amount_paid_ugx ?? 0));
      });
      setSum(s);
      setLoading(false);
    })();
  }, [canSeeFinance]);

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const list = useMemo(
    () =>
      rows.filter((r) => {
        if (!showArchived && r.archived_at) return false;
        if (showArchived && !r.archived_at) return false;
        if (!showArchived && status === "__onboarding") { if (r.status !== "Onboarding" && r.onboarding_status !== "in_progress") return false; }
        else if (!showArchived && status !== "all" && (r.status ?? "") !== status) return false;
        if (!q.trim()) return true;
        return `${r.name} ${r.territory ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
      }),
    [rows, q, status, showArchived]
  );

  const mine = (r: ResidentRecord) => r.contact_user_id === userId || r.handler_user_id === userId;
  const activeCount = rows.filter((r) => !r.archived_at && r.status === "Active").length;

  const tabs = [
    { key: "clients", label: "clients" },
    { key: "accounts", label: "accounts & handlers" },
    ...(has("founder", "admin") ? [{ key: "lifecycle", label: "lifecycle" }] : []),
  ] as const;

  return (
    <AppShell eyebrow="Residents">
      <Seo title="Residents — Site 99" description="Every resident we work with, in full." path="/app/residents" noindex />
      <PageHeader
        eyebrow="Residents"
        title="Residents."
        lede={`${activeCount} active clients. Open any card for their full record — content, shoots, money, contracts and relations.`}
      />
      {has("admin", "founder", "managing_director", "operations_manager", "communications", "client_relations") && (
        <div className="-mt-2 mb-5 [&>button]:w-full sm:-mt-4 sm:mb-6 sm:[&>button]:w-auto"><AddResidentDialog /></div>
      )}


      <div className="no-scrollbar mb-6 flex max-w-full gap-1 overflow-x-auto rounded-full surface-sunken p-1 sm:mb-8 sm:w-fit" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`press focus-ring rounded-full px-4 py-1.5 text-xs ${tab === t.key ? "bg-paper-raised text-ink" : "text-ink-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : tab === "accounts" ? (
        <>
          <PortalAccessPanel index="00" />
          <div className="mt-14"><AccountsPanel showNames index="01" /></div>
          {canSeeFinance && (
            <div className="mt-14">
              <ClientPayPanel />
            </div>
          )}
        </>
      ) : tab === "lifecycle" ? (
        <ClientLifecycleSwitch canSwitch={has("founder", "admin")} />
      ) : (
        <div>
          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Search a client" />
            {!showArchived && (
              <SelectFilter
                label="Status"
                value={status}
                onChange={setStatus}
                options={[{ value: "all", label: "All statuses" }, { value: "__onboarding", label: "Being onboarded" }, ...statuses.map((s) => ({ value: s, label: s }))]}
              />
            )}
            <button
              onClick={() => { setShowArchived(false); setStatus(status === "__onboarding" ? "Active" : "__onboarding"); }}
              aria-pressed={status === "__onboarding"}
              className={`press focus-ring rounded-full px-3 py-1.5 text-[11px] ${status === "__onboarding" && !showArchived ? "bg-paper-raised text-ink" : "surface-sunken text-ink-soft"}`}
            >
              onboarding
            </button>
            <button
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
              className={`press focus-ring rounded-full px-3 py-1.5 text-[11px] ${showArchived ? "bg-paper-raised text-ink" : "surface-sunken text-ink-soft"}`}
            >
              archived
            </button>
            <div className="ml-auto flex items-center gap-1 rounded-full surface-sunken p-1">
              {(["cards", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`press focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${view === v ? "bg-paper-raised text-ink" : "text-ink-soft"}`}
                >
                  {v === "cards" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                  {v}
                </button>
              ))}
            </div>
          </FilterBar>

          {list.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Nothing matches that.</p>
          ) : view === "cards" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {list.map((r) => {
                const x = sum[r.id];
                const left = x?.endsOn ? daysLeft(x.endsOn) : null;
                return (
                  <Link
                    key={r.id}
                    to={`/app/residents/${r.id}`}
                    className="press surface rounded-2xl p-5 focus-ring hover:bg-paper-raised flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-12 w-12 rounded-xl surface-sunken overflow-hidden flex items-center justify-center shrink-0">
                        {logos[r.id] ? (
                          <img src={logos[r.id]} alt={`${r.name} logo`} className="h-full w-full object-contain" />
                        ) : (
                          <span className="display text-sm text-ink-soft">{initials(r.name)}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="display text-base block truncate">{r.name}</span>
                        {r.territory && <span className="text-xs text-ink-faint block truncate">{r.territory}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ink-faint" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status && <StatusChip value={r.status} tone={clientTone(r.status)} />}
                      {mine(r) && <StatusChip value="yours" tone="violet" />}
                      {r.archived_at && <StatusChip value="archived" tone="neutral" />}
                      {!x?.contract && <StatusChip value="no contract" tone="neutral" />}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-ink-soft">
                      <div className="flex items-center gap-1.5 min-w-0"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{x?.handler ?? "no handler"}</span></div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span className={`truncate num ${left !== null && left <= 30 ? "text-signal font-semibold" : ""}`}>
                          {x?.endsOn ? `ends ${fmt(x.endsOn)} · ${left! < 0 ? "ended" : `${left}d`}` : "no end date"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5"><Clapperboard className="h-3.5 w-3.5 shrink-0" /><span className="num">{x?.moving ?? 0} in motion · {x?.accounts ?? 0} accounts</span></div>
                      <div className="flex items-center gap-1.5 min-w-0"><Camera className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{x?.nextShoot ? `shoot ${fmt(x.nextShoot)}` : "no shoot booked"}</span></div>
                      {canSeeFinance && (
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 shrink-0" />
                          <span className={`num ${x?.owed ? "text-signal font-semibold" : ""}`}>{x?.owed ? `UGX ${x.owed.toLocaleString()} owed` : "nothing owed"}</span>
                        </div>
                      )}
                    </dl>
                  </Link>
                );
              })}
            </div>
          ) : (
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mt-4">
              {list.map((r) => {
                const x = sum[r.id];
                return (
                  <li key={r.id}>
                    <Link to={`/app/residents/${r.id}`} className="press flex items-center gap-3 flex-wrap px-5 py-4 focus-ring hover:bg-paper-raised">
                      <span className="h-8 w-8 rounded-lg surface-sunken overflow-hidden flex items-center justify-center shrink-0">
                        {logos[r.id] ? <img src={logos[r.id]} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-ink-soft">{initials(r.name)}</span>}
                      </span>
                      <span className="display text-base">{r.name}</span>
                      {r.status && <StatusChip value={r.status} tone={clientTone(r.status)} />}
                      {mine(r) && <StatusChip value="yours" tone="violet" />}
                      <span className="ml-auto flex items-center gap-4 text-[11px] text-ink-soft">
                        <span>{x?.handler ?? "no handler"}</span>
                        <span className="num">{x?.moving ?? 0} in motion</span>
                        <span className="num">{x?.endsOn ? `ends ${fmt(x.endsOn)}` : "no end date"}</span>
                        {canSeeFinance && <span className={`num ${x?.owed ? "text-signal" : ""}`}>{x?.owed ? `UGX ${x.owed.toLocaleString()}` : "—"}</span>}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
