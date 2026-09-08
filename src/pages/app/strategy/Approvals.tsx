import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StrategyPage from "@/components/strategy/StrategyPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  REVIEW_KIND_LABEL,
  REVIEW_LABEL,
  REVIEW_TONE,
  metricLabel,
  monthLabel,
  reviewState,
  setReview,
  type ReviewTable,
} from "@/lib/strategy";
import { Check, Undo2 } from "lucide-react";

type Item = {
  table: ReviewTable;
  id: string;
  resident_id: string | null;
  what: string;
  state: string;
  submitted_at: string | null;
  submitted_by: string | null;
  note: string | null;
};

export default function StrategyApprovals() {
  const { canApproveStrategy } = useMyRoles();
  const [items, setItems] = useState<Item[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [r, tm, goals, targets, maps, plans, versions] = await Promise.all([
      supabase.from("residents").select("id, name"),
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase.from("client_goals").select("id, resident_id, title, review_state, submitted_at, submitted_by, review_note"),
      supabase.from("client_targets").select("id, resident_id, metric, month, target_value, review_state, submitted_at, submitted_by, review_note"),
      supabase.from("strategy_maps").select("id, resident_id, title, version, review_state, submitted_at, submitted_by, review_note"),
      supabase.from("client_plans").select("id, resident_id, review_state, submitted_at, submitted_by, review_note"),
      supabase.from("strategy_map_versions").select("id, resident_id, version, review_state, submitted_at, submitted_by, review_note"),
    ]);

    const out: Item[] = [];
    const push = (table: ReviewTable, row: Record<string, unknown>, what: string) => {
      out.push({
        table,
        id: String(row.id),
        resident_id: (row.resident_id as string) ?? null,
        what,
        state: String(row.review_state ?? "draft"),
        submitted_at: (row.submitted_at as string) ?? null,
        submitted_by: (row.submitted_by as string) ?? null,
        note: (row.review_note as string) ?? null,
      });
    };

    ((goals.data ?? []) as Record<string, unknown>[]).forEach((g) => push("client_goals", g, String(g.title)));
    ((targets.data ?? []) as Record<string, unknown>[]).forEach((t) =>
      push("client_targets", t, `${metricLabel(String(t.metric))} · ${monthLabel(String(t.month))} · ${Number(t.target_value).toLocaleString()}`)
    );
    ((maps.data ?? []) as Record<string, unknown>[]).forEach((m) => push("strategy_maps", m, `${m.title} (v${m.version})`));
    ((plans.data ?? []) as Record<string, unknown>[]).forEach((p) => push("client_plans", p, "Whole client plan"));
    ((versions.data ?? []) as Record<string, unknown>[]).forEach((v) => push("strategy_map_versions", v, `Map version ${v.version}`));

    setResidents((r.data as { id: string; name: string }[]) ?? []);
    setMembers((tm.data as { user_id: string; display_name: string | null; email: string }[]) ?? []);
    setItems(out);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const nameOf = (rid: string | null) => residents.find((r) => r.id === rid)?.name ?? "—";
  const personOf = (uid: string | null) => {
    if (!uid) return "someone";
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || "someone";
  };

  const waiting = useMemo(
    () =>
      items
        .filter((i) => reviewState(i.state) === "submitted")
        .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")),
    [items]
  );
  const recent = useMemo(
    () => items.filter((i) => reviewState(i.state) === "approved" || reviewState(i.state) === "changes_requested").slice(0, 20),
    [items]
  );

  const act = async (item: Item, next: "approved" | "changes_requested") => {
    let note: string | null = null;
    if (next === "changes_requested") {
      note = window.prompt("What should change?") || null;
      if (!note) return;
    }
    setBusy(item.id);
    try {
      await setReview(item.table, item.id, next, note);
      toast.success(next === "approved" ? "Approved" : "Sent back with your note");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <StrategyPage
      title="Approvals."
      lede={
        canApproveStrategy
          ? "Everything waiting on a founder: maps, goals, monthly targets and whole client plans."
          : "Where each piece of strategy stands. Only founders can approve or send work back."
      }
      path="/app/strategy/approvals"
    >
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <SectionHeading index="01" title="Waiting" hint={`${waiting.length} item${waiting.length === 1 ? "" : "s"}`} />
          {waiting.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing is waiting. All clear.</p>
          ) : (
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {waiting.map((i) => (
                <li key={`${i.table}-${i.id}`} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                  <StatusChip value={REVIEW_KIND_LABEL[i.table]} tone="neutral" />
                  <Link to={`/app/residents/${i.resident_id}/strategy`} className="press focus-ring text-sm font-semibold">
                    {nameOf(i.resident_id)}
                  </Link>
                  <span className="text-sm text-ink-soft">{i.what}</span>
                  <span className="text-[11px] text-ink-faint ml-auto">
                    from {personOf(i.submitted_by)}
                    {i.submitted_at ? ` · ${i.submitted_at.slice(0, 10)}` : ""}
                  </span>
                  {canApproveStrategy && (
                    <span className="flex items-center gap-2">
                      <Button size="sm" className="gap-1.5" disabled={busy === i.id} onClick={() => act(i, "approved")}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busy === i.id}
                        onClick={() => act(i, "changes_requested")}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Send back
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-14">
            <SectionHeading index="02" title="Recently decided" />
            {recent.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing decided yet.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {recent.map((i) => {
                  const rs = reviewState(i.state);
                  return (
                    <li key={`${i.table}-${i.id}`} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      <StatusChip value={REVIEW_KIND_LABEL[i.table]} tone="neutral" />
                      <span className="text-sm">{nameOf(i.resident_id)}</span>
                      <span className="text-sm text-ink-soft">{i.what}</span>
                      <StatusChip value={REVIEW_LABEL[rs]} tone={REVIEW_TONE[rs]} className="ml-auto" />
                      {i.note && <span className="w-full text-[11px] text-ink-soft">“{i.note}”</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </StrategyPage>
  );
}
