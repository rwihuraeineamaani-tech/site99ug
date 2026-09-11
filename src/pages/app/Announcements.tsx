import { useEffect, useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SearchInput, StatusChip } from "@/components/system";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadCommunicationReads } from "@/lib/communications";

export default function AnnouncementsPage() {
  const { userId } = useMyRoles();
  const { data = [], isLoading } = useAnnouncements(true);
  const [search, setSearch] = useState("");
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => { if (userId) loadCommunicationReads(userId, "announcement").then(setRead).catch(() => undefined); }, [userId]);
  const shown = useMemo(() => data.filter((a) => `${a.title} ${a.body ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  return <AppShell eyebrow="Announcements"><Seo title="Announcements — Site 99" description="Published Site 99 notices." path="/app/announcements" noindex /><PageHeader eyebrow="Announcements" title="Studio notices." lede="Published updates for the team, kept separate from private conversations." />
    <SearchInput value={search} onChange={setSearch} placeholder="Search announcements" className="mb-6 max-w-md" />
    {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : shown.length === 0 ? <div className="rounded-lg border border-rule py-16 text-center"><Megaphone className="mx-auto h-7 w-7 text-ink-faint" /><p className="mt-3 text-sm text-ink-soft">No announcements yet.</p></div> : <div className="divide-y divide-rule border-y border-rule">{shown.map((item) => <Link key={item.id} to={`/app/announcements/${item.id}`} className="grid gap-3 py-6 focus-ring md:grid-cols-[140px_1fr_auto]"><div className="text-xs text-ink-faint">{new Date(item.published_at || item.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div><div><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm text-ink-soft">{item.body}</p></div><StatusChip value={read.has(item.id) ? "Read" : "New"} tone={read.has(item.id) ? "neutral" : "amber"} /></Link>)}</div>}
  </AppShell>;
}
