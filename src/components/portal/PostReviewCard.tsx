import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { finalCaption, profileUrl, REVIEW_LABEL, tagsOf, windowLabel, type ReviewFields } from "@/lib/postReview";

export type ReviewItem = ReviewFields & { id: string; title: string; platforms: string[]; posted_at: string | null };

/** Client side: review the cut, caption, collab, tags and posting window, then approve or ask for changes. */
export default function PostReviewCard({ item, onDone, readOnly = false, canApprove = false }: { item: ReviewItem; onDone: () => void; readOnly?: boolean; canApprove?: boolean }) {
  const [caption, setCaption] = useState(finalCaption(item));
  const [collabOk, setCollabOk] = useState(item.collab_status !== "rejected");
  const [rejected, setRejected] = useState<string[]>(tagsOf(item).filter((t) => t.status === "rejected").map((t) => t.handle));
  const [note, setNote] = useState(item.client_review_note ?? "");
  const [busy, setBusy] = useState(false);
  const locked = !!item.posted_at || readOnly;

  const send = async (decision: "approved" | "changes" | "pending") => {
    setBusy(true);
    const { error } = await supabase.rpc("client_review_content" as never, {
      _id: item.id, _caption: caption, _collab_ok: item.collab_handle ? collabOk : null,
      _rejected_tags: rejected, _decision: decision, _note: note,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? (canApprove ? "Approved. It has gone to your handler to post." : "Approved. Your handler has been told.") : decision === "changes" ? "Sent to your handler." : "Saved.");
    onDone();
  };

  return (
    <div className="rounded-2xl border border-hairline p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{item.title}</div>
          <div className="text-xs text-ink-faint">{windowLabel(item)} · {item.platforms?.join(", ") || "Platform to confirm"}</div>
        </div>
        <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px]">{item.posted_at ? "Posted" : REVIEW_LABEL[item.client_review_state ?? "pending"]}</span>
      </div>

      <div className="mt-3">
        {item.edit_file_url
          ? <a href={item.edit_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-signal">Watch on Google Drive <ExternalLink className="h-3.5 w-3.5" /></a>
          : <span className="text-xs text-ink-faint">The final cut is still being edited.</span>}
      </div>

      <label className="mt-3 block">
        <span className="eyebrow text-ink-faint">Caption, you can edit it</span>
        <textarea rows={4} disabled={locked} className="mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption coming soon." />
      </label>

      {item.collab_handle && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span>Collaboration with <a href={profileUrl(item.collab_handle, item.collab_url)} target="_blank" rel="noreferrer" className="text-signal">{item.collab_handle}</a></span>
          <Button size="sm" variant={collabOk ? "outline" : "destructive"} disabled={locked} onClick={() => setCollabOk(!collabOk)}>{collabOk ? "Reject collab" : "Collab rejected, undo"}</Button>
        </div>
      )}

      {tagsOf(item).length > 0 && (
        <div className="mt-3">
          <div className="eyebrow text-ink-faint">Tagged accounts</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {tagsOf(item).map((t) => {
              const off = rejected.includes(t.handle);
              return (
                <span key={t.handle} className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-xs">
                  <a href={profileUrl(t.handle, t.url)} target="_blank" rel="noreferrer" className={off ? "line-through opacity-60" : "text-signal"}>{t.handle}</a>
                  {!locked && <button type="button" className="text-ink-faint" onClick={() => setRejected(off ? rejected.filter((x) => x !== t.handle) : [...rejected, t.handle])}>{off ? "undo" : "reject"}</button>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {!locked && (
        <>
          <label className="mt-3 block">
            <span className="eyebrow text-ink-faint">Note for your handler</span>
            <input className="mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Needed only if you want changes" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => send("approved")}>{canApprove ? "Approve video" : "Approve post"}</Button>
            <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => send("changes")}>Request changes</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => send("pending")}>Save edits</Button>
          </div>
        </>
      )}
    </div>
  );
}
