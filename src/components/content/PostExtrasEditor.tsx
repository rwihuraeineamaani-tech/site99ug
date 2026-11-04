import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { REVIEW_LABEL, tagsOf, type PostTag, type ReviewFields } from "@/lib/postReview";

type Item = ReviewFields & { id: string };
const field = "mt-1 w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm";
const toLocal = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(" ", "T") : "";
const fromLocal = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : null);

/** Staff side: what the client reviews (collab, tags, window), plus the client's answer. */
export default function PostExtrasEditor({ item, onSaved }: { item: Item; onSaved?: () => void }) {
  const [collab, setCollab] = useState(item.collab_handle ?? "");
  const [collabUrl, setCollabUrl] = useState(item.collab_url ?? "");
  const [tags, setTags] = useState(tagsOf(item).map((t) => t.handle).join(", "));
  const [from, setFrom] = useState(toLocal(item.post_window_start));
  const [to, setTo] = useState(toLocal(item.post_window_end));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCollab(item.collab_handle ?? ""); setCollabUrl(item.collab_url ?? "");
    setTags(tagsOf(item).map((t) => t.handle).join(", "));
    setFrom(toLocal(item.post_window_start)); setTo(toLocal(item.post_window_end));
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const old = new Map(tagsOf(item).map((t) => [t.handle, t]));
    const next: PostTag[] = tags.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).map((h) => old.get(h) ?? { handle: h, status: "proposed" });
    const collabChanged = (collab.trim() || null) !== (item.collab_handle ?? null);
    setBusy(true);
    const { error } = await supabase.from("content_items").update({
      collab_handle: collab.trim() || null,
      collab_url: collabUrl.trim() || null,
      ...(collabChanged ? { collab_status: "proposed" } : {}),
      tags: next as never,
      post_window_start: fromLocal(from),
      post_window_end: fromLocal(to),
    }).eq("id", item.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved for the client to review");
    onSaved?.();
  };

  const state = item.client_review_state ?? "pending";
  return (
    <div className="mt-3 rounded-xl border border-hairline p-3">
      <div className="eyebrow text-ink-faint">What the client reviews</div>
      <p className="mt-1 text-xs text-ink-soft">
        {REVIEW_LABEL[state] ?? state}{item.client_review_note ? `: "${item.client_review_note}"` : "."}
        {item.client_caption ? " They edited the caption, use their version." : ""}
      </p>
      {item.client_caption && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper-raised p-2 text-xs">{item.client_caption}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-sm"><span className="eyebrow text-ink-faint">Collab account</span>
          <input className={field} placeholder="@partner" value={collab} onChange={(e) => setCollab(e.target.value)} />
          {item.collab_handle && <span className="text-[11px] text-ink-faint">Client: {item.collab_status}</span>}
        </label>
        <label className="text-sm"><span className="eyebrow text-ink-faint">Collab profile link</span>
          <input className={field} placeholder="https://instagram.com/partner" value={collabUrl} onChange={(e) => setCollabUrl(e.target.value)} />
        </label>
      </div>
      <label className="mt-2 block text-sm"><span className="eyebrow text-ink-faint">Tagged accounts, separated by commas</span>
        <input className={field} placeholder="@one, @two" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      {tagsOf(item).some((t) => t.status === "rejected") && (
        <p className="mt-1 text-[11px] text-destructive">Client rejected: {tagsOf(item).filter((t) => t.status === "rejected").map((t) => t.handle).join(", ")}</p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-sm"><span className="eyebrow text-ink-faint">Window opens</span><input type="datetime-local" className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="eyebrow text-ink-faint">Window closes</span><input type="datetime-local" className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">Leave the window empty and the client sees two hours around the posting time.</p>
      <Button size="sm" className="mt-2" disabled={busy} onClick={save}>Save review details</Button>
    </div>
  );
}
