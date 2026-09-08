import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { Metric, SectionHeading, StatusChip } from "@/components/system";
import { daysUntil, dueLabel, dueTone, niceDate } from "@/lib/legal";

type Contract = { id: string; title: string; party_name: string; status: string; ends_on: string | null };
type Item = { id: string; name: string; renews_on: string | null; status: string };

export default function LegalOverview() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, o, rc, res] = await Promise.all([
        supabase.from("contracts").select("id, title, party_name, status, ends_on"),
        supabase.from("compliance_items").select("id, name, renews_on, status"),
        supabase.from("resident_contracts").select("id, title, status, ends_on, resident_id"),
        supabase.from("residents").select("id, name"),
      ]);
      const names = new Map(((res.data as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name]));
      const residentContracts = ((rc.data as { id: string; title: string; status: string; ends_on: string | null; resident_id: string }[]) ?? []).map(
        (r) => ({
          id: r.id,
          title: r.title,
          party_name: names.get(r.resident_id) ?? "Resident",
          status: r.status,
          ends_on: r.ends_on,
        })
      );
      setContracts([...((c.data as Contract[]) ?? []), ...residentContracts]);
      setItems((o.data as Item[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const active = contracts.filter((c) => c.status === "active");
  const unsigned = contracts.filter((c) => c.status === "draft" || c.status === "out for signature");
  const expiring = useMemo(
    () =>
      contracts
        .filter((c) => {
          const d = daysUntil(c.ends_on);
          return d !== null && d <= 60;
        })
        .sort((a, b) => (daysUntil(a.ends_on) ?? 0) - (daysUntil(b.ends_on) ?? 0)),
    [contracts]
  );
  const dueItems = useMemo(
    () =>
      items
        .filter((i) => {
          const d = daysUntil(i.renews_on);
          return d !== null && d <= 60 && i.status !== "retired";
        })
        .sort((a, b) => (daysUntil(a.renews_on) ?? 0) - (daysUntil(b.renews_on) ?? 0)),
    [items]
  );

  return (
    <SectionPage
      eyebrow="Legal"
      title="Legal."
      lede="What needs signing, what is running out, and what has to be renewed."
      path="/app/legal"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Metric label="Contracts running" value={loading ? "—" : active.length} />
        <Metric label="Expiring in 60 days" value={loading ? "—" : expiring.length} tone="signal" />
        <Metric label="Waiting on signature" value={loading ? "—" : unsigned.length} />
        <Metric label="Renewals due" value={loading ? "—" : dueItems.length} />
      </div>

      <SectionHeading index="01" title="Contracts running out" hint="Next 60 days" />
      {!expiring.length ? (
        <div className="surface rounded-xl p-8 text-sm text-ink-soft mb-10">Nothing expires in the next two months.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mb-10">
          {expiring.map((c) => (
            <li key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-semibold text-sm">{c.title}</div>
                <div className="text-xs text-ink-soft">{c.party_name}</div>
              </div>
              <span className="text-xs text-ink-soft w-32">{niceDate(c.ends_on)}</span>
              <StatusChip value={dueLabel(c.ends_on)} tone={dueTone(c.ends_on)} />
              <StatusChip value={c.status} />
            </li>
          ))}
        </ul>
      )}

      <SectionHeading index="02" title="Renewals and obligations" hint="Next 60 days" />
      {!dueItems.length ? (
        <div className="surface rounded-xl p-8 text-sm text-ink-soft mb-10">Nothing due soon.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mb-10">
          {dueItems.map((i) => (
            <li key={i.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem] font-semibold text-sm">{i.name}</div>
              <span className="text-xs text-ink-soft w-32">{niceDate(i.renews_on)}</span>
              <StatusChip value={dueLabel(i.renews_on)} tone={dueTone(i.renews_on)} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { to: "/app/legal/contracts", label: "Contracts" },
          { to: "/app/legal/partnerships", label: "Partnerships" },
          { to: "/app/legal/documents", label: "Documents" },
          { to: "/app/legal/compliance", label: "Compliance" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="ctl eyebrow px-5 py-2.5 focus-ring">
            {l.label} →
          </Link>
        ))}
      </div>
    </SectionPage>
  );
}
