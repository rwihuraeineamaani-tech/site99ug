import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/system/AppShell";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { finalCaption, profileUrl, REVIEW_LABEL, tagsOf, windowLabel, type ReviewFields } from "@/lib/postReview";

type Row = ReviewFields & { id: string; title: string; platforms: string[]; stage: string; resident_id: string | null; residents?: { name: string } | null };

const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));

export default function ReadyToPost() {
  const { id } = useParams();
  const [row, setRow] = useState<Row | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase.from("content_items").select("*, residents(name)").eq("id", id!).maybeSingle().then(({ data }) => {
      if (!data) setMissing(true);
      setRow(data as unknown as Row);
    });
  }, [id]);

  const at = row?.scheduled_post_at
    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(row.scheduled_post_at))
    : "Time to confirm";
  const tags = row ? tagsOf(row).filter((t) => t.status !== "rejected") : [];
  const collabOn = row?.collab_handle && row.collab_status !== "rejected";

  return (
    <AppShell title="Ready to post" lede="Everything you need to put this video out.">
      <Seo title="Ready to post" />
      {missing && <p className="text-sm text-ink-soft">This post was not found or is not yours to see.</p>}
      {row && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-2xl border border-hairline p-4">
            <div className="eyebrow text-ink-faint">{row.residents?.name ?? "Client"}</div>
            <h2 className="mt-1 text-xl font-semibold">{row.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">Post at {at} on {row.platforms?.join(", ") || "the planned platforms"}. Client window: {windowLabel(row)}.</p>
            <p className="mt-1 text-xs text-ink-faint">{REVIEW_LABEL[row.client_review_state ?? "pending"]}{row.client_review_note ? `: "${row.client_review_note}"` : "."}</p>
          </div>
          <div className="rounded-2xl border border-hairline p-4">
            <div className="flex items-center justify-between"><span className="eyebrow text-ink-faint">Final cut</span>
              {row.edit_file_url && <a href={row.edit_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-signal">Open cut <ExternalLink className="h-3.5 w-3.5" /></a>}</div>
            {!row.edit_file_url && <p className="mt-1 text-sm text-ink-soft">No cut link yet. Ask the editor.</p>}
          </div>
          <div className="rounded-2xl border border-hairline p-4">
            <div className="flex items-center justify-between"><span className="eyebrow text-ink-faint">Caption{row.client_caption ? ", edited by the client" : ""}</span>
              <Button size="sm" variant="outline" onClick={() => copy(finalCaption(row), "Caption")}><Copy /> Copy</Button></div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{finalCaption(row) || "No caption yet."}</p>
          </div>
          <div className="rounded-2xl border border-hairline p-4">
            <div className="flex items-center justify-between"><span className="eyebrow text-ink-faint">Tags and collab</span>
              {tags.length > 0 && <Button size="sm" variant="outline" onClick={() => copy(tags.map((t) => t.handle).join(" "), "Tags")}><Copy /> Copy tags</Button>}</div>
            <p className="mt-2 text-sm">{collabOn ? <>Collab with <a className="text-signal" href={profileUrl(row.collab_handle!, row.collab_url)} target="_blank" rel="noreferrer">{row.collab_handle}</a></> : row.collab_handle ? "Client rejected the collab, post without it." : "No collab."}</p>
            <p className="mt-1 text-sm text-ink-soft">{tags.length ? tags.map((t) => t.handle).join(", ") : "No tags."}</p>
          </div>
          <Button asChild><Link to="/app/content">Mark posted in the pipeline</Link></Button>
        </div>
      )}
    </AppShell>
  );
}
