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

            </FilterBar>

            {list.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing matches that.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mt-4">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/app/residents/${r.id}`}
                      className="press flex items-center gap-3 flex-wrap px-5 py-4 focus-ring hover:bg-paper-raised"
                    >
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
