import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { Metric, PageHeader, SectionHeading, StatusChip, formatUGX } from "@/components/system";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—");
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

type Booking = { id: string; booked_on: string; fee_ugx: number; status: string; brief: string | null; shoot_day_id: string | null; campaign_id: string | null };
type Contract = { id: string; title: string; usage_terms: string | null; territory: string | null; starts_on: string | null; ends_on: string | null; status: string };
type Campaign = { id: string; name: string; status: string; starts_on: string | null; ends_on: string | null; platforms: string[] };
type Result = { campaign_id: string; talent_id: string | null; reach: number; engagements: number; clicks: number };

const TITLES: Record<string, string> = { overview: "Your work.", bookings: "Bookings.", contracts: "Contracts & releases.", earnings: "Earnings.", campaigns: "Campaign results." };

export default function TalentPortal() {
  const { tab = "overview" } = useParams();
  const { talentId } = useMyRoles();
  const [name, setName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (!talentId) return;
    (async () => {
      const [t, b, c, cp, r] = await Promise.all([
        db.from("talent").select("name").eq("id", talentId).maybeSingle(),
        db.from("talent_bookings").select("id, booked_on, fee_ugx, status, brief, shoot_day_id, campaign_id").eq("talent_id", talentId).order("booked_on", { ascending: false }),
        db.from("talent_contracts").select("*").eq("talent_id", talentId).order("ends_on"),
        db.from("campaigns").select("id, name, status, starts_on, ends_on, platforms").order("starts_on", { ascending: false }),
        db.from("campaign_results").select("campaign_id, talent_id, reach, engagements, clicks"),
      ]);
      setName(t.data?.name ?? "");
      setBookings(b.data ?? []); setContracts(c.data ?? []); setCampaigns(cp.data ?? []); setResults(r.data ?? []);
    })();
  }, [talentId]);

  const upcoming = bookings.filter((b) => b.status !== "cancelled" && daysTo(b.booked_on) >= 0).reverse();
  const owed = bookings.filter((b) => b.status === "confirmed" || b.status === "done").reduce((a, b) => a + b.fee_ugx, 0);
  const paid = bookings.filter((b) => b.status === "paid").reduce((a, b) => a + b.fee_ugx, 0);
  const campName = (id: string | null) => campaigns.find((c) => c.id === id)?.name;

  const BookingList = ({ list }: { list: Booking[] }) => (
    <ul className="surface rounded-2xl divide-y divide-rule">
      {list.map((b) => (
        <li key={b.id} className="px-5 py-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{day(b.booked_on)}</span>
            {campName(b.campaign_id) && <span className="text-ink-soft">{campName(b.campaign_id)}</span>}
            {b.shoot_day_id && <span className="text-[11px] text-ink-faint">shoot day</span>}
            <StatusChip value={b.status} />
            <span className="ml-auto num">{formatUGX(b.fee_ugx)}</span>
          </div>
          {b.brief && <p className="mt-2 text-ink-soft">{b.brief}</p>}
        </li>
      ))}
      {!list.length && <li className="px-5 py-4 text-sm text-ink-soft">Nothing here yet.</li>}
    </ul>
  );

  return (
    <AppShell eyebrow="Talent portal">
      <Seo title="Talent portal — Site 99" description="Your bookings, contracts and earnings." path="/talent-portal" noindex />
      <PageHeader eyebrow={name || "Talent portal"} title={TITLES[tab] ?? TITLES.overview} lede="Only you can see this — your bookings, agreements, pay and results." />
      {!talentId ? (
        <div className="surface rounded-2xl p-10 text-center text-sm text-ink-soft">Your login isn't linked to a talent profile yet. Ask your Site 99 contact.</div>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-12">
                <Metric label="Upcoming bookings" value={String(upcoming.length)} />
                <Metric label="Owed to you" value={formatUGX(owed)} />
                <Metric label="Paid so far" value={formatUGX(paid)} />
                <Metric label="Campaigns" value={String(campaigns.length)} />
              </div>
              <SectionHeading index="01" title="Coming up" />
              <BookingList list={upcoming.slice(0, 5)} />
            </>
          )}
          {tab === "bookings" && <BookingList list={bookings} />}
          {tab === "contracts" && (
            <ul className="surface rounded-2xl divide-y divide-rule">
              {contracts.map((c) => (
                <li key={c.id} className="px-5 py-4 text-sm flex flex-wrap gap-3 items-center">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-ink-soft">{c.usage_terms ?? ""}{c.territory ? ` · ${c.territory}` : ""}</span>
                  <StatusChip value={c.status} />
                  {c.ends_on && c.status === "signed" && daysTo(c.ends_on) <= 45 && <StatusChip value={daysTo(c.ends_on) < 0 ? "usage ended" : `${daysTo(c.ends_on)} days left`} tone="amber" />}
                  <span className="ml-auto text-[11px] text-ink-faint">{day(c.starts_on)} → {day(c.ends_on)}</span>
                </li>
              ))}
              {!contracts.length && <li className="px-5 py-4 text-sm text-ink-soft">No agreements yet.</li>}
            </ul>
          )}
          {tab === "earnings" && (
            <>
              <div className="grid gap-4 grid-cols-2 mb-8"><Metric label="Owed to you" value={formatUGX(owed)} /><Metric label="Paid" value={formatUGX(paid)} /></div>
              <BookingList list={bookings.filter((b) => b.status !== "cancelled" && b.status !== "requested")} />
            </>
          )}
          {tab === "campaigns" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {campaigns.map((c) => {
                const rs = results.filter((r) => r.campaign_id === c.id);
                const mine = rs.filter((r) => r.talent_id === talentId);
                const sum = (xs: Result[], k: "reach" | "engagements" | "clicks") => xs.reduce((a, r) => a + r[k], 0);
                return (
                  <div key={c.id} className="surface rounded-2xl p-4">
                    <div className="flex items-center gap-2"><span className="display text-base flex-1">{c.name}</span><StatusChip value={c.status} /></div>
                    <div className="mt-2 text-[11px] text-ink-faint">{day(c.starts_on)} → {day(c.ends_on)} · {c.platforms.join(", ")}</div>
                    <div className="mt-3 text-sm text-ink-soft">Campaign reach {sum(rs, "reach").toLocaleString()} · engagements {sum(rs, "engagements").toLocaleString()}</div>
                    {mine.length > 0 && <div className="text-sm">Your posts: reach {sum(mine, "reach").toLocaleString()} · engagements {sum(mine, "engagements").toLocaleString()}</div>}
                  </div>
                );
              })}
              {!campaigns.length && <p className="text-sm text-ink-soft">You're not on a campaign yet.</p>}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
