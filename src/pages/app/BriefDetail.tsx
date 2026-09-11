import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import DocumentDetail from "@/components/communications/DocumentDetail";
import { useMyRoles } from "@/hooks/useMyRoles";
import { supabase } from "@/integrations/supabase/client";
import { markCommunicationRead } from "@/lib/communications";
import type { Brief } from "@/hooks/useBriefs";

export default function BriefDetailPage() {
  const { id = "" } = useParams();
  const { userId } = useMyRoles();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [client, setClient] = useState("Client");
  useEffect(() => { let live = true; (async () => { const { data } = await supabase.from("briefs").select("*").eq("id", id).maybeSingle(); if (!live || !data) return; const row = data as unknown as Brief; setBrief(row); const { data: rs } = await supabase.rpc("resident_options"); setClient(((rs as { id: string; name: string }[]) ?? []).find((r) => r.id === row.resident_id)?.name ?? "Client"); if (userId) await markCommunicationRead(userId, "brief", id); })(); return () => { live = false; }; }, [id, userId]);
  return <AppShell eyebrow="Brief">{brief ? <><Seo title={`${brief.title} — Site 99`} description="Client brief." path={`/app/briefs/${id}`} noindex /><DocumentDetail backTo="/app/briefs" backLabel="All briefs" kind="Shoot brief" title={brief.title} body={brief.body} date={brief.created_at} fileUrl={brief.file_url} metadata={<><span>{client}</span>{brief.shoot_day_id && <Link className="text-signal hover:underline" to={`/app/shoots/${brief.shoot_day_id}`}>Open shoot day</Link>}{brief.content_id && <Link className="text-signal hover:underline" to="/app/content">Open content</Link>}</>} /></> : <p className="text-sm text-ink-soft">Loading brief…</p>}</AppShell>;
}
