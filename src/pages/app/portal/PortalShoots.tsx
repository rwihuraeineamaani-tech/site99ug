import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Money, StatusChip } from "@/components/system";

type Shoot = {
  id: string;
  shoot_date: string | null;
  call_time: string | null;
  location: string | null;
  status: string;
  notes: string | null;
};

type Spend = { id: string; shoot_day_id: string; amount_ugx: number; payer: string; category: string; note: string | null; spent_on: string };

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Date to confirm";

export default function PortalShoots() {
  const { client, clientId, loading } = usePortalClient();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [spend, setSpend] = useState<Spend[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [sd, sp] = await Promise.all([
        supabase
          .from("shoot_days")
          .select("id, shoot_date, call_time, location, status, notes")
          .eq("resident_id", clientId)
          .order("shoot_date", { ascending: false })
          .limit(50),
        supabase
          .from("shoot_spend")
          .select("id, shoot_day_id, amount_ugx, payer, category, note, spent_on")
          .eq("resident_id", clientId)
          .eq("payer", "client")
          .order("spent_on", { ascending: false }),
      ]);
      if (cancelled) return;
      setShoots((sd.data as Shoot[]) ?? []);
      setSpend((sp.data as Spend[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = shoots.filter((s) => (s.shoot_date ?? "9999") >= today);
  const past = shoots.filter((s) => (s.shoot_date ?? "9999") < today);

  const spentOn = (id: string) => spend.filter((s) => s.shoot_day_id === id).reduce((t, s) => t + Number(s.amount_ugx || 0), 0);

  const Row = ({ s }: { s: Shoot }) => (
    <li className="rounded-xl border border-hairline px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">{fmt(s.shoot_date)}</div>
        <StatusChip value={s.status} />
      </div>
      <div className="mt-1 text-xs text-ink-faint">
        {s.call_time ? `Call ${s.call_time}` : "Call time to confirm"}
        {s.location ? ` · ${s.location}` : ""}
      </div>
      {s.notes && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{s.notes}</p>}
      <div className="mt-2 text-xs text-ink-faint">
        Paid from your fund: <Money amount={spentOn(s.id)} className="text-ink" />
      </div>
    </li>
  );

  return (
    <PortalPage
      title="Shoot days"
      lede="When we are filming, where, and what your fund covered."
      client={client}
      loading={loading}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="Coming up" hint={`${upcoming.length}`}>
          {upcoming.length === 0 ? (
            <PortalEmpty>No shoot day booked yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="Past shoots" hint={`${past.length}`}>
          {past.length === 0 ? (
            <PortalEmpty>Nothing filmed yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {past.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
