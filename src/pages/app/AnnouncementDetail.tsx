import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import DocumentDetail from "@/components/communications/DocumentDetail";
import { useMyRoles } from "@/hooks/useMyRoles";
import { supabase } from "@/integrations/supabase/client";
import { markCommunicationRead } from "@/lib/communications";
import type { Announcement } from "@/hooks/useAnnouncements";

export default function AnnouncementDetailPage() {
  const { id = "" } = useParams();
  const { userId } = useMyRoles();
  const [item, setItem] = useState<Announcement | null>(null);
  useEffect(() => { supabase.from("announcements").select("*").eq("id", id).eq("published", true).maybeSingle().then(async ({ data }) => { if (!data) return; setItem(data as unknown as Announcement); if (userId) await markCommunicationRead(userId, "announcement", id); }); }, [id, userId]);
  return <AppShell eyebrow="Announcement">{item ? <><Seo title={`${item.title} — Site 99`} description="Studio announcement." path={`/app/announcements/${id}`} noindex /><DocumentDetail backTo="/app/announcements" backLabel="All announcements" kind="Studio announcement" title={item.title} body={item.body} date={item.published_at || item.created_at} /></> : <p className="text-sm text-ink-soft">Loading announcement…</p>}</AppShell>;
}
