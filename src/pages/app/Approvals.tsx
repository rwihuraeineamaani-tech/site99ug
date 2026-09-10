import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip, formatUGX } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  KIND_LABEL,
  loadApprovals,
  waitingFor,
  type ApprovalItem,
  type DecidedItem,
} from "@/lib/approvals";

function Row({ item, onDone }: { item: ApprovalItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const run = async (a: ApprovalItem["actions"][number]) => {
    let note: string | undefined;
    if (a.ask) {
      note = window.prompt(a.ask) || undefined;
      if (!note) return;
    }
    setBusy(true);
    try {
      await a.run(note);
      toast.success(`${a.label} — done.`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <li className="px-5 py-4 flex flex-wrap items-center gap-3">
      <StatusChip value={KIND_LABEL[item.kind]} tone="neutral" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{item.move}</div>
        <div className="mt-0.5 text-sm text-ink-soft truncate">
          {item.title}
          {item.who ? ` · ${item.who}` : ""}
        </div>
        <div className="mt-1 text-[11px] text-ink-faint">
          {item.detail ? `${item.detail} · ` : ""}waiting {waitingFor(item.since)}
          {item.mine ? "" : ` · with the ${item.waitingOn}`}
        </div>
      </div>
      {item.amount ? <span className="num text-sm">{formatUGX(item.amount)}</span> : null}
      <Link to={item.to} className="press focus-ring text-xs underline underline-offset-4 text-ink-soft">
        Open
      </Link>
      {item.actions.map((a) => (
        <Button key={a.label} size="sm" variant={a.ghost ? "outline" : "default"} disabled={busy} onClick={() => run(a)}>
          {a.label}
        </Button>
      ))}
    </li>
  );
}

export default function Approvals() {
  const { userId, has, canApproveStrategy, canSeeFinance, loading: rolesLoading } = useMyRoles();
  const isFounder = has("admin", "founder");
  const isMd = has("admin", "founder", "managing_director");

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [decided, setDecided] = useState<DecidedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const out = await loadApprovals({ userId, isFounder, isMd, canApproveStrategy, canSeeFinance });
    setItems(out.items);
    setDecided(out.decided);
    setLoading(false);
  };

  useEffect(() => {
    if (rolesLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, userId, isFounder, isMd, canApproveStrategy]);

  const mine = useMemo(() => items.filter((i) => i.mine), [items]);
  const others = useMemo(() => items.filter((i) => !i.mine), [items]);
  const canApproveAnything = isFounder || isMd || canApproveStrategy;

  return (
    <AppShell eyebrow="Approvals">
      <Seo
        title="Approvals — Site 99"
        description="Everything across the studio waiting for a sign-off, in one place."
        path="/app/approvals"
        noindex
      />
      <PageHeader
        eyebrow="Approvals"
        title="Approvals."
        lede={
          canApproveAnything
            ? "Everything sitting with you: money, payments, loans, strategy and content. Decide right here."
            : "Where every sign-off in the studio currently sits, so you know who is holding a thing up."
        }
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <SectionHeading index="01" title="Waiting on you" hint={`${mine.length} item${mine.length === 1 ? "" : "s"}`} />
          {mine.length === 0 ? (
            <p className="text-sm text-ink-soft">
              {canApproveAnything ? "Nothing needs your sign-off. All clear." : "You are not a sign-off point right now."}
            </p>
          ) : (
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {mine.map((i) => (
                <Row key={i.id} item={i} onDone={load} />
              ))}
            </ul>
          )}

          <div className="mt-14">
            <SectionHeading index="02" title="Waiting on someone else" hint={`${others.length}`} />
            {others.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing is stuck elsewhere.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {others.slice(0, 25).map((i) => (
                  <Row key={i.id} item={i} onDone={load} />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-14">
            <SectionHeading index="03" title="Recently decided" />
            {decided.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing decided yet.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {decided.map((d) => (
                  <li key={d.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <StatusChip value={KIND_LABEL[d.kind]} tone="neutral" />
                    <span className="text-sm truncate flex-1">{d.title}</span>
                    <span className="text-[11px] text-ink-faint">{d.when ? d.when.slice(0, 10) : ""}</span>
                    <StatusChip value={d.outcome} tone={d.tone} />
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
