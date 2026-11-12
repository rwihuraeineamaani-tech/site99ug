import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/system";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Idea = { id: string; title: string; notes: string | null; link: string | null; stage: string; client_idea_month: string | null; declined_note: string | null; created_at: string };

export function ideaProgress(stage: string): { label: string; tone: "neutral" | "teal" | "violet" | "stop" } {
  if (stage === "Idea") return { label: "Received", tone: "neutral" };
  if (stage === "Archived") return { label: "Not taken forward", tone: "stop" };
  if (stage === "Posted") return { label: "Posted", tone: "teal" };
  if (stage === "Approved" || stage === "Crewed") return { label: "Accepted", tone: "violet" };
  return { label: "In production", tone: "violet" };
}

export default function PortalIdeas() {
  const { client, loading } = usePortalClient();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [f, setF] = useState({ title: "", description: "", ref: "", month: "" });
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await db.rpc("my_client_ideas"); setIdeas(data ?? []); };
  useEffect(() => { if (client) load(); }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!f.title.trim()) return toast.error("Give your idea a title.");
    setBusy(true);
    const { error } = await db.rpc("client_suggest_idea", { _title: f.title, _description: f.description || null, _ref: f.ref || null, _month: f.month ? `${f.month}-01` : null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Idea sent to your team.");
    setF({ title: "", description: "", ref: "", month: "" });
    load();
  };

  return (
    <PortalPage title="Video ideas" lede="Seen something you love, or have a product moment coming up? Send it in and follow it all the way to posting." client={client} loading={loading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="Suggest an idea">
          <div className="space-y-3 text-sm">
            <input className="ctl w-full rounded-xl px-3 py-2" placeholder="Idea title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} />
            <textarea className="ctl w-full rounded-xl p-3" rows={4} placeholder="What happens in the video? Who is in it?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <input className="ctl w-full rounded-xl px-3 py-2" placeholder="Reference link (optional)" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
            <label className="block text-xs text-ink-faint">Preferred month (optional)
              <input type="month" className="ctl mt-1 w-full rounded-xl px-3 py-2 text-sm" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
            </label>
            <Button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send idea"}</Button>
          </div>
        </PortalCard>
        <PortalCard title="Your ideas" hint={`${ideas.length}`}>
          {!ideas.length ? <PortalEmpty>No ideas sent yet.</PortalEmpty> : (
            <ul className="space-y-2">
              {ideas.map((i) => { const p = ideaProgress(i.stage); return (
                <li key={i.id} className="rounded-xl border border-hairline px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{i.title}</span><StatusChip value={p.label} tone={p.tone} /></div>
                  <div className="text-xs text-ink-faint">Sent {new Date(i.created_at).toLocaleDateString("en-GB")}{i.client_idea_month ? ` · for ${new Date(i.client_idea_month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}` : ""}</div>
                  {i.stage === "Archived" && i.declined_note && <p className="mt-1 text-xs text-ink-soft">{i.declined_note}</p>}
                </li>); })}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
