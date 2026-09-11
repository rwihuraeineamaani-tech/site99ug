import { useEffect, useMemo, useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SearchInput, StatusChip } from "@/components/system";
import { useBriefs } from "@/hooks/useBriefs";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadCommunicationReads } from "@/lib/communications";
import { supabase } from "@/integrations/supabase/client";

export default function BriefsPage() {
  const { userId } = useMyRoles();
  const { data = [], isLoading } = useBriefs();
  const [search, setSearch] = useState("");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [residents, setResidents] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (userId) loadCommunicationReads(userId, "brief").then(setRead).catch(() => undefined);
    supabase.rpc("resident_options").then(({ data }) => setResidents(new Map(((data as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name]))));
  }, [userId]);
  const shown = useMemo(() => data.filter((brief) => `${brief.title} ${brief.body ?? ""} ${residents.get(brief.resident_id) ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search, residents]);
  return <AppShell eyebrow="Briefs"><Seo title="Briefs — Site 99" description="Shoot and client briefs." path="/app/briefs" noindex /><PageHeader eyebrow="Briefs" title="The work, properly briefed." lede="Open the full brief, linked shoot and attachments before the work starts." />
    <SearchInput value={search} onChange={setSearch} placeholder="Search briefs" className="mb-6 max-w-md" />
    {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : shown.length === 0 ? <div className="rounded-lg border border-rule py-16 text-center"><FileText className="mx-auto h-7 w-7 text-ink-faint" /><p className="mt-3 text-sm text-ink-soft">No briefs found.</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((brief) => <Link key={brief.id} to={`/app/briefs/${brief.id}`} className="card-lift rounded-lg border border-rule bg-paper-raised p-5 focus-ring"><div className="flex items-center justify-between gap-2"><StatusChip value={read.has(brief.id) ? "Opened" : "New"} tone={read.has(brief.id) ? "neutral" : "teal"} />{brief.file_url && <Paperclip className="h-4 w-4 text-ink-faint" />}</div><h2 className="mt-4 text-lg font-semibold leading-snug">{brief.title}</h2><p className="mt-2 line-clamp-3 text-sm text-ink-soft">{brief.body || "Open the brief for full details."}</p><div className="mt-5 flex items-center justify-between border-t border-rule pt-3 text-[11px] text-ink-faint"><span>{residents.get(brief.resident_id) ?? "Client"}</span><span>{new Date(brief.created_at).toLocaleDateString()}</span></div></Link>)}</div>}
  </AppShell>;
}
