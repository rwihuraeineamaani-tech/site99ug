import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip, SearchInput, SelectFilter, FilterBar } from "@/components/system";
import AccountsPanel from "@/components/system/AccountsPanel";
import ClientPayPanel from "@/components/system/ClientPayPanel";
import { useMyRoles } from "@/hooks/useMyRoles";
import { logoUrls, initials } from "@/lib/logo";
import { ChevronRight, LayoutGrid, Rows3 } from "lucide-react";

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
};

const VIEW_KEY = "site99:residents-view";

export default function ResidentsHub() {
  const { userId, canSeeFinance } = useMyRoles();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ResidentRecord[]>([]);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [accountCount, setAccountCount] = useState<Record<string, number>>({});
  const [contentCount, setContentCount] = useState<Record<string, number>>({});
  const [contracted, setContracted] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"cards" | "list">(
    () => (localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards")
  );

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);


  useEffect(() => {
    (async () => {
      const [{ data: res }, { data: acc }, { data: content }, { data: contracts }] = await Promise.all([
        supabase.rpc("resident_records"),
        supabase.from("client_accounts").select("resident_id, active"),
        supabase.from("content_items").select("resident_id"),
        supabase.from("resident_contracts").select("resident_id, status"),
      ]);
      const people = (res as unknown as ResidentRecord[]) ?? [];
      setRows(people);
      logoUrls(people.map((p) => ({ id: p.id, avatar_url: p.avatar_url }))).then(setLogos);

      const a: Record<string, number> = {};
      ((acc as { resident_id: string; active: boolean }[]) ?? []).forEach((r) => {
        if (r.active) a[r.resident_id] = (a[r.resident_id] ?? 0) + 1;
      });
      setAccountCount(a);
      const c: Record<string, number> = {};
      ((content as { resident_id: string | null }[]) ?? []).forEach((r) => {
        if (r.resident_id) c[r.resident_id] = (c[r.resident_id] ?? 0) + 1;
      });
      setContentCount(c);
      setContracted(
        new Set(
          ((contracts as { resident_id: string; status: string }[]) ?? [])
            .filter((r) => r.status === "active")
            .map((r) => r.resident_id)
        )
      );
      setLoading(false);
    })();
  }, []);

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const list = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "all" && (r.status ?? "") !== status) return false;
        if (!q.trim()) return true;
        const s = `${r.name} ${r.territory ?? ""} ${r.email ?? ""}`.toLowerCase();
        return s.includes(q.trim().toLowerCase());
      }),
    [rows, q, status]
  );

  const mine = (r: ResidentRecord) => r.contact_user_id === userId || r.handler_user_id === userId;

  return (
    <AppShell eyebrow="Residents">
      <Seo title="Residents — Site 99" description="Every resident we work with, in full." path="/app/residents" noindex />
      <PageHeader
        eyebrow="Residents"
        title="Residents."
        lede="Every client we look after — their accounts, their content, their contracts and their numbers, all on one record."
      />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <AccountsPanel showNames index="00" />

          {canSeeFinance && (
            <div className="mt-14">
              <ClientPayPanel />
            </div>
          )}

          <div className="mt-14">
            <SectionHeading index="01" title="Everyone we work with" hint={`${list.length} of ${rows.length}`} />
            <FilterBar>
              <SearchInput value={q} onChange={setQ} placeholder="Search a resident" />
              <SelectFilter
                label="Status"
                value={status}
                onChange={setStatus}
                options={[{ value: "all", label: "All statuses" }, ...statuses.map((s) => ({ value: s, label: s }))]}
              />
              <div className="ml-auto flex items-center gap-1 rounded-full surface-sunken p-1">
                {(["cards", "list"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`press focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${
                      view === v ? "bg-paper-raised text-ink" : "text-ink-soft"
                    }`}
                  >
                    {v === "cards" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                    {v === "cards" ? "Cards" : "List"}
                  </button>
                ))}
              </div>
            </FilterBar>

            {list.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing matches that.</p>
            ) : view === "cards" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((r) => (
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
                      <span className="min-w-0">
                        <span className="display text-base block truncate">{r.name}</span>
                        {r.territory && <span className="text-xs text-ink-faint block truncate">{r.territory}</span>}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status && <StatusChip value={r.status} tone={r.status === "active" ? "teal" : "neutral"} />}
                      {mine(r) && <StatusChip value="yours" tone="violet" />}
                      <StatusChip
                        value={contracted.has(r.id) ? "contract active" : "no contract"}
                        tone={contracted.has(r.id) ? "teal" : "neutral"}
                      />
                    </div>
                    <div className="mt-auto flex items-center gap-4 text-[11px] text-ink-soft">
                      <span className="num">{accountCount[r.id] ?? 0} accounts</span>
                      <span className="num">{contentCount[r.id] ?? 0} items</span>
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mt-4">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/app/residents/${r.id}`}
                      className="press flex items-center gap-3 flex-wrap px-5 py-4 focus-ring hover:bg-paper-raised"
                    >
                      <span className="h-8 w-8 rounded-lg surface-sunken overflow-hidden flex items-center justify-center shrink-0">
                        {logos[r.id] ? (
                          <img src={logos[r.id]} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-ink-soft">{initials(r.name)}</span>
                        )}
                      </span>
                      <span className="display text-base">{r.name}</span>
                      {r.territory && <span className="text-xs text-ink-faint">{r.territory}</span>}
                      {r.status && <StatusChip value={r.status} tone={r.status === "active" ? "teal" : "neutral"} />}
                      {mine(r) && <StatusChip value="yours" tone="violet" />}
                      <span className="ml-auto flex items-center gap-4 text-[11px] text-ink-soft">
                        <span className="num">{accountCount[r.id] ?? 0} accounts</span>
                        <span className="num">{contentCount[r.id] ?? 0} items</span>
                        <span className={contracted.has(r.id) ? "text-acc-teal" : "text-ink-faint"}>
                          {contracted.has(r.id) ? "contract active" : "no contract"}
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

          </div>
        </>
      )}
    </AppShell>
  );
}
