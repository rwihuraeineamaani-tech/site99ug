import { useEffect, useMemo, useState } from "react";
import { Camera, FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SearchInput, StatusChip } from "@/components/system";
import { useBriefs } from "@/hooks/useBriefs";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadCommunicationReads } from "@/lib/communications";
import { supabase } from "@/integrations/supabase/client";

type ShootBrief = { id: string; resident_id: string | null; shoot_date: string | null; call_time: string | null; location: string | null; notes: string | null; status: string; brief_sent_at: string | null };

export default function BriefsPage() {
  const { userId } = useMyRoles();
  const { data = [], isLoading } = useBriefs();
  const [search, setSearch] = useState("");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [residents, setResidents] = useState<Map<string, string>>(new Map());
  const [shoots, setShoots] = useState<ShootBrief[]>([]);
  useEffect(() => {
    if (userId) loadCommunicationReads(userId, "brief").then(setRead).catch(() => undefined);
    supabase.rpc("resident_options").then(({ data }) => setResidents(new Map(((data as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name]))));
    supabase.from("shoot_days").select("id,resident_id,shoot_date,call_time,location,notes,status,brief_sent_at").in("status", ["draft", "confirmed", "shooting"]).order("shoot_date", { ascending: true }).then(({ data }) => setShoots((data as ShootBrief[]) ?? []));
  }, [userId]);

  const shownShoots = useMemo(() => shoots.filter((s) => `${residents.get(s.resident_id ?? "") ?? ""} ${s.location ?? ""} ${s.notes ?? ""} shoot day brief`.toLowerCase().includes(search.toLowerCase())), [shoots, search, residents]);
  const shown = useMemo(() => data.filter((brief) => `${brief.title} ${brief.body ?? ""} ${residents.get(brief.resident_id) ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search, residents]);
  const empty = !shown.length && !shownShoots.length;

  return <AppShell eyebrow="Briefs">
    <Seo title="Briefs — Site 99" description="Shoot and client briefs." path="/app/briefs" noindex />
    <PageHeader eyebrow="Briefs" title="The work, properly briefed." lede="Shoot day briefs come first, then every client brief with its linked work and attachments." />
    <SearchInput value={search} onChange={setSearch} placeholder="Search briefs" className="mb-6 max-w-md" />
    {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : empty ? <div className="rounded-lg border border-rule py-16 text-center"><FileText className="mx-auto h-7 w-7 text-ink-faint" /><p className="mt-3 text-sm text-ink-soft">No briefs found.</p></div> : <div className="space-y-8">
      {shownShoots.length > 0 && <section>
        <h2 className="eyebrow mb-3 text-ink-faint">Shoot day briefs</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shownShoots.map((s) => <Link key={s.id} to={`/app/shoots/${s.id}`} className="card-lift rounded-lg border border-signal/40 bg-paper-raised p-5 focus-ring">
          <div className="flex items-center justify-between gap-2"><StatusChip value={s.brief_sent_at ? "Brief sent" : "Shoot day"} tone={s.brief_sent_at ? "neutral" : "teal"} /><Camera className="h-4 w-4 text-ink-faint" /></div>
          <h3 className="mt-4 text-lg font-semibold leading-snug">{residents.get(s.resident_id ?? "") ?? "Shoot day"}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{[s.call_time ? `Call ${s.call_time}` : null, s.location, s.notes].filter(Boolean).join(" · ") || "Open the shoot day for the full brief."}</p>
          <div className="mt-5 flex items-center justify-between border-t border-rule pt-3 text-[11px] text-ink-faint"><span>{s.status}</span><span>{s.shoot_date ? new Date(s.shoot_date).toLocaleDateString() : "Date to confirm"}</span></div>
        </Link>)}</div>
      </section>}
      {shown.length > 0 && <section>
        <h2 className="eyebrow mb-3 text-ink-faint">Client briefs</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((brief) => <Link key={brief.id} to={`/app/briefs/${brief.id}`} className="card-lift rounded-lg border border-rule bg-paper-raised p-5 focus-ring"><div className="flex items-center justify-between gap-2"><StatusChip value={read.has(brief.id) ? "Opened" : "New"} tone={read.has(brief.id) ? "neutral" : "teal"} />{brief.file_url && <Paperclip className="h-4 w-4 text-ink-faint" />}</div><h3 className="mt-4 text-lg font-semibold leading-snug">{brief.title}</h3><p className="mt-2 line-clamp-3 text-sm text-ink-soft">{brief.body || "Open the brief for full details."}</p><div className="mt-5 flex items-center justify-between border-t border-rule pt-3 text-[11px] text-ink-faint"><span>{residents.get(brief.resident_id) ?? "Client"}</span><span>{new Date(brief.created_at).toLocaleDateString()}</span></div></Link>)}</div>
      </section>}
    </div>}
  </AppShell>;
}
