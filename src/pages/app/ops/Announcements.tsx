import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { field, ghostBtn, solidBtn } from "@/lib/legal";

type Note = { id: string; title: string; body: string | null; published: boolean; created_at: string };

export default function Announcements() {
  const { isLeadership } = useMyRoles();
  const [rows, setRows] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, published, created_at")
      .order("created_at", { ascending: false });
    setRows((data as Note[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (published: boolean) => {
    if (!title.trim()) return toast.error("Give it a headline.");
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim() || null, published });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setBody("");
    toast.success(published ? "Posted." : "Saved as a draft.");
    load();
  };

  const toggle = async (n: Note) => {
    const { error } = await supabase.from("announcements").update({ published: !n.published }).eq("id", n.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <SectionPage
      eyebrow="Management"
      title="Announcements."
      lede="Anything the whole studio needs to know, shown on everyone's dashboard."
      path="/app/ops/announcements"
    >
      {isLeadership && (
        <section className="mb-10 surface rounded-2xl p-5 md:p-6">
          <SectionHeading index="00" title="Write one" hint="Goes to every signed-in person" />
          <label className="text-xs text-ink-soft block">
            Headline
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-xs text-ink-soft block mt-4">
            The message
            <textarea rows={4} className={field} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="mt-5 flex gap-2">
            <button className={ghostBtn} disabled={busy} onClick={() => post(false)}>
              Save draft
            </button>
            <button className={solidBtn} disabled={busy} onClick={() => post(true)}>
              Post it
            </button>
          </div>
        </section>
      )}

      {!rows.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">Nothing announced yet.</div>
      ) : (
        <ul className="space-y-4">
          {rows.map((n) => (
            <li key={n.id} className="surface rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-xs text-ink-faint">
                    {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <StatusChip value={n.published ? "published" : "draft"} tone={n.published ? "teal" : "neutral"} />
              </div>
              {n.body && <p className="mt-3 text-sm text-ink-soft whitespace-pre-wrap">{n.body}</p>}
              {isLeadership && (
                <button className={`${ghostBtn} mt-4`} onClick={() => toggle(n)}>
                  {n.published ? "Take it down" : "Publish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}
