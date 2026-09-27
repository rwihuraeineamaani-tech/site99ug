import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";

type Member = { user_id: string; display_name: string | null; email: string };
type Interaction = { id: string; resident_id: string; kind: string; summary: string; happened_at: string; created_by: string | null };
type Followup = { id: string; resident_id: string; title: string; due_date: string | null; assigned_to: string | null; done_at: string | null; created_by: string | null };
type Feedback = { id: string; resident_id: string; rating: number; kind: string; note: string | null; created_at: string; created_by: string | null };

export type RelationsView = "all" | "log" | "followups" | "feedback";

const KINDS = ["call", "meeting", "message", "visit", "complaint"];
const today = () => new Date().toISOString().slice(0, 10);
const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Client Relations tables aren't in generated types until the next sync.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Contact log, follow-ups and feedback — for one client, or across all when residentId is omitted. */
export default function RelationsPanel({
  residentId,
  members,
  view = "all",
  residents,
}: {
  residentId?: string;
  members: Member[];
  view?: RelationsView;
  residents?: { id: string; name: string }[];
}) {
  const { userId, isLeadership } = useMyRoles();
  const [log, setLog] = useState<Interaction[]>([]);
  const [follow, setFollow] = useState<Followup[]>([]);
  const [fb, setFb] = useState<Feedback[]>([]);
  const [pick, setPick] = useState(residentId ?? "");
  const [kind, setKind] = useState("call");
  const [summary, setSummary] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fDue, setFDue] = useState("");
  const [fWho, setFWho] = useState("");
  const [rating, setRating] = useState(4);
  const [fbNote, setFbNote] = useState("");
  const [fbKind, setFbKind] = useState("feedback");
  const [mineOnly, setMineOnly] = useState(false);

  const load = async () => {
    const scope = (q: ReturnType<typeof db.from>) => (residentId ? q.eq("resident_id", residentId) : q);
    const [a, b, c] = await Promise.all([
      scope(db.from("client_interactions").select("*")).order("happened_at", { ascending: false }).limit(200),
      scope(db.from("client_followups").select("*")).order("due_date", { ascending: true, nullsFirst: false }).limit(300),
      scope(db.from("client_feedback").select("*")).order("created_at", { ascending: false }).limit(200),
    ]);
    setLog((a.data as Interaction[]) ?? []);
    setFollow((b.data as Followup[]) ?? []);
    setFb((c.data as Feedback[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId]);

  const nameOf = (uid: string | null) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || "—";
  };
  const clientOf = (rid: string) => residents?.find((r) => r.id === rid)?.name ?? "";
  const target = residentId ?? pick;
  const canRemove = (by: string | null) => by === userId || isLeadership;

  const addLog = async () => {
    if (!target || !summary.trim()) return toast.error("Pick a client and write what happened.");
    const { error } = await db.from("client_interactions").insert({ resident_id: target, kind, summary: summary.trim(), created_by: userId });
    if (error) return toast.error(error.message);
    setSummary("");
    load();
  };
  const addFollow = async () => {
    if (!target || !fTitle.trim()) return toast.error("Pick a client and say what needs doing.");
    const { error } = await db.from("client_followups").insert({ resident_id: target, title: fTitle.trim(), due_date: fDue || null, assigned_to: fWho || userId, created_by: userId });
    if (error) return toast.error(error.message);
    setFTitle("");
    setFDue("");
    load();
  };
  const addFb = async () => {
    if (!target) return toast.error("Pick a client first.");
    const { error } = await db.from("client_feedback").insert({ resident_id: target, rating, kind: fbKind, note: fbNote.trim() || null, created_by: userId });
    if (error) return toast.error(error.message);
    setFbNote("");
    load();
  };
  const toggleDone = async (f: Followup) => {
    const { error } = await db.from("client_followups").update({ done_at: f.done_at ? null : new Date().toISOString() }).eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (table: string, rowId: string) => {
    const { error } = await db.from(table).delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    load();
  };

  const openFollow = useMemo(
    () => follow.filter((f) => !f.done_at && (!mineOnly || f.assigned_to === userId)),
    [follow, mineOnly, userId]
  );
  const avg = fb.length ? (fb.reduce((s, x) => s + x.rating, 0) / fb.length).toFixed(1) : "—";

  const clientPicker = !residentId && (
    <select className="field text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
      <option value="">Which client?</option>
      {(residents ?? []).map((r) => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  );
  const clientTag = (rid: string) =>
    !residentId && (
      <Link to={`/app/residents/${rid}`} className="text-[11px] underline underline-offset-4 text-ink-soft">
        {clientOf(rid)}
      </Link>
    );

  return (
    <div className="space-y-14">
      {(view === "all" || view === "log") && (
        <section>
          <SectionHeading index="01" title="Contact log" hint={`${log.length} logged`} />
          <div className="surface rounded-2xl p-4 grid gap-3 md:grid-cols-[auto_auto_1fr_auto] items-center">
            {clientPicker}
            <select className="field text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <input className="field text-sm" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was said or agreed" />
            <Button size="sm" onClick={addLog}>log it</Button>
          </div>
          <ul className="mt-3 surface rounded-2xl overflow-hidden divide-y divide-rule">
            {log.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <StatusChip value={i.kind} tone={i.kind === "complaint" ? "stop" : "neutral"} />
                {clientTag(i.resident_id)}
                <span className="text-sm flex-1 min-w-[12rem]">{i.summary}</span>
                <span className="text-[11px] text-ink-faint num">{day(i.happened_at)} · {nameOf(i.created_by)}</span>
                {canRemove(i.created_by) && (
                  <button aria-label="remove" onClick={() => remove("client_interactions", i.id)} className="text-ink-faint hover:text-signal focus-ring">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
            {log.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No contact logged yet.</li>}
          </ul>
        </section>
      )}

      {(view === "all" || view === "followups") && (
        <section>
          <SectionHeading index="02" title="Follow-ups" hint={`${openFollow.length} open`} />
          <div className="surface rounded-2xl p-4 grid gap-3 md:grid-cols-[auto_1fr_auto_auto_auto] items-center">
            {clientPicker}
            <input className="field text-sm" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="What needs doing" />
            <input type="date" className="field text-sm" value={fDue} onChange={(e) => setFDue(e.target.value)} />
            <select className="field text-sm" value={fWho} onChange={(e) => setFWho(e.target.value)}>
              <option value="">Me</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
            </select>
            <Button size="sm" onClick={addFollow}>add</Button>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> only mine
          </label>
          <ul className="mt-2 surface rounded-2xl overflow-hidden divide-y divide-rule">
            {openFollow.map((f) => {
              const late = f.due_date && f.due_date < today();
              return (
                <li key={f.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  <button aria-label="mark done" onClick={() => toggleDone(f)} className="h-5 w-5 rounded-full border border-rule grid place-items-center hover:border-signal focus-ring">
                    <Check className="h-3 w-3 opacity-40" />
                  </button>
                  {clientTag(f.resident_id)}
                  <span className="text-sm flex-1 min-w-[12rem]">{f.title}</span>
                  <span className={`text-[11px] num ${late ? "text-signal font-semibold" : "text-ink-faint"}`}>
                    {f.due_date ? `${late ? "overdue · " : ""}${day(f.due_date)}` : "no date"} · {nameOf(f.assigned_to)}
                  </span>
                  {canRemove(f.created_by) && (
                    <button aria-label="remove" onClick={() => remove("client_followups", f.id)} className="text-ink-faint hover:text-signal focus-ring">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
            {openFollow.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">Nothing waiting.</li>}
          </ul>
        </section>
      )}

      {(view === "all" || view === "feedback") && (
        <section>
          <SectionHeading index="03" title="Feedback" hint={`average ${avg} / 5`} />
          <div className="surface rounded-2xl p-4 grid gap-3 md:grid-cols-[auto_auto_auto_1fr_auto] items-center">
            {clientPicker}
            <select className="field text-sm" value={fbKind} onChange={(e) => setFbKind(e.target.value)}>
              <option value="feedback">feedback</option>
              <option value="praise">praise</option>
              <option value="complaint">complaint</option>
            </select>
            <div className="flex gap-1" aria-label="rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="focus-ring">
                  <Star className={`h-4 w-4 ${n <= rating ? "fill-current text-signal" : "text-ink-faint"}`} />
                </button>
              ))}
            </div>
            <input className="field text-sm" value={fbNote} onChange={(e) => setFbNote(e.target.value)} placeholder="What did they say?" />
            <Button size="sm" onClick={addFb}>save</Button>
          </div>
          <ul className="mt-3 surface rounded-2xl overflow-hidden divide-y divide-rule">
            {fb.map((f) => (
              <li key={f.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <span className="num text-sm text-signal">{"★".repeat(f.rating)}</span>
                <StatusChip value={f.kind} tone={f.kind === "complaint" ? "stop" : f.kind === "praise" ? "teal" : "neutral"} />
                {clientTag(f.resident_id)}
                <span className="text-sm flex-1 min-w-[12rem]">{f.note ?? ""}</span>
                <span className="text-[11px] text-ink-faint num">{day(f.created_at)} · {nameOf(f.created_by)}</span>
                {canRemove(f.created_by) && (
                  <button aria-label="remove" onClick={() => remove("client_feedback", f.id)} className="text-ink-faint hover:text-signal focus-ring">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
            {fb.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No feedback recorded yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
