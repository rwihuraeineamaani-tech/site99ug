import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { StatusChip } from "@/components/system";

type Item = {
  id: string;
  title: string;
  stage: string;
  content_type: string;
  platforms: string[] | null;
  planned_at: string | null;
  posted_at: string | null;
  posted_links: string[] | null;
};

type Brief = { id: string; title: string; body: string | null; file_url: string | null; created_at: string };

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date to confirm";

export default function PortalWork() {
  const { client, clientId, loading } = usePortalClient();
  const [items, setItems] = useState<Item[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [ci, br] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, title, stage, content_type, platforms, planned_at, posted_at, posted_links")
          .eq("resident_id", clientId)
          .order("planned_at", { ascending: false })
          .limit(100),
        supabase
          .from("briefs")
          .select("id, title, body, file_url, created_at")
          .eq("resident_id", clientId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      setItems((ci.data as Item[]) ?? []);
      setBriefs((br.data as Brief[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const live = items.filter((i) => i.posted_at);
  const upcoming = items.filter((i) => !i.posted_at);

  return (
    <PortalPage
      title="Your work"
      lede="Everything we are making for you, and what is already live."
      client={client}
      loading={loading}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="In progress" hint={`${upcoming.length}`}>
          {upcoming.length === 0 ? (
            <PortalEmpty>Nothing in the works right now.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((i) => (
                <li key={i.id} className="rounded-xl border border-hairline px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm">{i.title}</div>
                    <StatusChip value={i.stage} />
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    {i.content_type} · planned {fmt(i.planned_at)}
                    {i.platforms?.length ? ` · ${i.platforms.join(", ")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="Already live" hint={`${live.length}`}>
          {live.length === 0 ? (
            <PortalEmpty>Nothing published yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {live.map((i) => (
                <li key={i.id} className="rounded-xl border border-hairline px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm">{i.title}</div>
                    <span className="text-xs text-ink-faint">{fmt(i.posted_at)}</span>
                  </div>
                  {i.posted_links?.length ? (
                    <div className="mt-1 flex flex-wrap gap-3">
                      {i.posted_links.map((l) => (
                        <a key={l} href={l} target="_blank" rel="noreferrer" className="text-xs text-signal underline">
                          Watch it
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

      <div className="mt-6">
        <PortalCard title="Briefs shared with you" hint={`${briefs.length}`}>
          {briefs.length === 0 ? (
            <PortalEmpty>No briefs yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {briefs.map((b) => (
                <li key={b.id} className="rounded-xl border border-hairline px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">{b.title}</div>
                    <span className="text-xs text-ink-faint">{fmt(b.created_at)}</span>
                  </div>
                  {b.body && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{b.body}</p>}
                  {b.file_url && (
                    <a href={b.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-signal underline">
                      Open the file
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
