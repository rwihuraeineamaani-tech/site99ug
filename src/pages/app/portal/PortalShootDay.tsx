import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, MapPin } from "lucide-react";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/system";
import { NEED_STATUS, briefDate, clientCost, downloadShootBrief, loadShootBrief, ugx, type ShootBrief } from "@/lib/shootBriefPdf";

export default function PortalShootDay() {
  const { id = "" } = useParams();
  const { client, loading } = usePortalClient();
  const [b, setB] = useState<ShootBrief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadShootBrief(id).then(setB).catch((e) => setErr(e.message)); }, [id]);

  return (
    <PortalPage title={b ? briefDate(b.shoot_date) : "Shoot day"} lede="Everything you need for this shoot: when, where, what we are filming and what we need from you." client={client} loading={loading}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/portal/shoots"><ArrowLeft className="h-4 w-4" /> All shoot days</Link></Button>
        {b && <Button size="sm" className="ml-auto" onClick={() => downloadShootBrief(b, "client")}><Download className="h-4 w-4" /> Download brief (PDF)</Button>}
      </div>
      {err && <PortalEmpty>{err}</PortalEmpty>}
      {b && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PortalCard title="When and where">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><StatusChip value={b.status} /></div>
              <div>Call time: <span className="text-ink">{b.call_time ?? "to confirm"}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-faint" />{b.location ?? "Location to confirm"}
                {b.location && <a className="text-signal text-xs" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(b.location)}`}>Open map</a>}</div>
              {b.notes && <p className="whitespace-pre-line text-ink-soft">{b.notes}</p>}
            </div>
          </PortalCard>
          <PortalCard title="Site 99 team coming" hint={`${b.crew.length}`}>
            {b.crew.length === 0 ? <PortalEmpty>Crew to be confirmed.</PortalEmpty> :
              <ul className="space-y-1 text-sm">{b.crew.map((c, i) => <li key={i}>{c.name} <span className="text-ink-faint">· {c.role}</span></li>)}</ul>}
          </PortalCard>
          <PortalCard title="Videos we are shooting" hint={`${b.items.length}`}>
            {b.items.length === 0 ? <PortalEmpty>Videos to be confirmed.</PortalEmpty> :
              <ul className="space-y-2">{b.items.map((i) => <li key={i.ref_no} className="rounded-xl border border-hairline px-3 py-2 text-sm"><div className="font-medium">{i.title}</div>{i.content_type && <div className="text-xs text-ink-faint">{i.content_type}</div>}{i.notes && <p className="mt-1 whitespace-pre-line text-ink-soft">{i.notes}</p>}</li>)}</ul>}
          </PortalCard>
          <PortalCard title="What we need from you" hint={clientCost(b) ? ugx(clientCost(b)) : undefined}>
            {b.needs.length === 0 ? <PortalEmpty>Nothing needed from you for this shoot.</PortalEmpty> : (
              <ul className="space-y-2">{b.needs.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">{n.item} <span className="text-ink-faint">x{n.qty}</span>{n.note && <span className="block text-xs text-ink-faint">{n.note}</span>}</span>
                  {n.unit_price_ugx > 0 && <span className="num text-xs">{ugx(n.qty * n.unit_price_ugx)}</span>}
                  <span className="text-[11px] text-ink-faint">{n.payer === "client" ? "You supply" : "Site 99 covers"}</span>
                  <StatusChip value={NEED_STATUS[n.status]} tone={n.status === "provided" ? "teal" : n.status === "ready" ? "violet" : "neutral"} />
                </li>))}</ul>
            )}
            {clientCost(b) > 0 && <div className="mt-3 text-sm">Your costs for this shoot: <span className="num font-semibold">{ugx(clientCost(b))}</span></div>}
          </PortalCard>
        </div>
      )}
    </PortalPage>
  );
}
