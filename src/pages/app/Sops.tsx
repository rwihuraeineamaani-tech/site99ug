import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from "lucide-react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, StatusChip } from "@/components/system";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { SOP_DEPARTMENTS, deptLabel, type Sop, type SopSections, type SopStep } from "@/lib/sops";

const db = supabase as any;
const input = "w-full rounded-md border border-rule bg-paper-sunken px-3 py-2 text-sm focus-ring";
const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 eyebrow text-[10px] focus-ring";

type Version = { id: string; version: number; title: string; change_note: string | null; created_at: string; sections: SopSections; summary: string | null; owner_role: string | null };

export default function SopsPage() {
  const { isAdmin, userId, isLeadership } = useMyRoles();
  const [params, setParams] = useSearchParams();
  const dept = params.get("dept") ?? "";
  const openId = params.get("sop");
  const [sops, setSops] = useState<Sop[]>([]);
  const [reads, setReads] = useState<{ sop_id: string; user_id: string; version: number }[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Sop | null>(null);

  const load = async () => {
    const [{ data }, { data: r }] = await Promise.all([
      db.from("sops").select("*").order("department").order("sort").order("title"),
      db.from("sop_reads").select("sop_id,user_id,version"),
    ]);
    setSops((data ?? []) as Sop[]);
    setReads(r ?? []);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return sops.filter((s) => (!dept || s.department === dept) && (!t || `${s.title} ${s.summary ?? ""} ${JSON.stringify(s.sections)}`.toLowerCase().includes(t)));
  }, [sops, dept, q]);
  const open = sops.find((s) => s.id === openId) ?? null;
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("sop", id); else p.delete("sop"); setParams(p); };
  const setDept = (d: string) => { const p = new URLSearchParams(); if (d) p.set("dept", d); setParams(p); };
  const iRead = (s: Sop) => reads.some((r) => r.sop_id === s.id && r.user_id === userId && r.version === s.version);

  const newSop = () => setEditing({ id: "", department: dept || "ops", title: "", summary: "", owner_role: "", status: "draft", version: 0, sections: { steps: [] }, sort: 0, updated_at: "", published_at: null });

  if (editing) return (
    <AppShell>
      <Seo title="Edit SOP — Site 99" description="Edit a standard operating procedure." path="/app/sops" noindex />
      <SopEditor sop={editing} onClose={() => setEditing(null)} onSaved={async (id) => { setEditing(null); await load(); setOpen(id); }} />
    </AppShell>
  );

  return (
    <AppShell>
      <Seo title="SOPs — Site 99" description="Standard operating procedures for every department." path="/app/sops" noindex />
      <PageHeader
        eyebrow={dept ? deptLabel(dept) : "SOP Library"}
        title={dept ? "SOPs." : "How we work."}
        lede="Step-by-step procedures for every department: who does what, where in Site 99, and what counts as done. Only the System Admin and Founders can change them."
        actions={isAdmin ? <button className={`${btn} bg-signal text-paper`} onClick={newSop}><Plus className="h-3.5 w-3.5" />New SOP</button> : undefined}
      />

      {open ? (
        <SopView sop={open} read={iRead(open)} canEdit={isAdmin} canSeeReads={isAdmin || isLeadership} reads={reads.filter((r) => r.sop_id === open.id && r.version === open.version)}
          onBack={() => setOpen(null)} onEdit={() => setEditing(open)} onChanged={load} userId={userId} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <input className={`${input} max-w-xs`} placeholder="Search procedures…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${input} max-w-[14rem]`} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {SOP_DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          {!shown.length && <p className="rounded-md border border-rule p-5 text-sm text-ink-soft">No procedures here yet{isAdmin ? " — add one with New SOP." : "."}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((s) => (
              <button key={s.id} onClick={() => setOpen(s.id)} className="rounded-xl border border-rule bg-paper-raised p-5 text-left hover:border-signal/50 focus-ring">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="eyebrow text-[10px] text-ink-faint">{deptLabel(s.department)}</span>
                  {s.status !== "published" && <StatusChip tone={s.status === "draft" ? "warn" : "neutral"} value={s.status} />}
                  {s.status === "published" && (iRead(s) ? <span className="text-[11px] text-acc-lime">read v{s.version}</span> : <span className="text-[11px] text-signal">not read yet</span>)}
                </div>
                <div className="font-semibold">{s.title}</div>
                {s.summary && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{s.summary}</p>}
                <div className="mt-3 text-[11px] text-ink-faint">{s.sections.steps?.length ?? 0} steps · owner {s.owner_role || "—"}{s.version ? ` · v${s.version}` : ""}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="mt-6">
      <h3 className="eyebrow mb-2 text-ink-faint">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </section>
  );
}

function SopView({ sop, read, canEdit, canSeeReads, reads, onBack, onEdit, onChanged, userId }: {
  sop: Sop; read: boolean; canEdit: boolean; canSeeReads: boolean; reads: { user_id: string }[]; userId: string | null;
  onBack: () => void; onEdit: () => void; onChanged: () => void;
}) {
  const s = sop.sections ?? {};
  const [versions, setVersions] = useState<Version[]>([]);
  const [staff, setStaff] = useState<{ user_id: string; name: string }[]>([]);
  useEffect(() => {
    if (canEdit || canSeeReads) db.from("sop_versions").select("*").eq("sop_id", sop.id).order("version", { ascending: false }).then(({ data }: any) => setVersions(data ?? []));
    if (canSeeReads) db.from("team_members").select("user_id,name").not("user_id", "is", null).then(({ data }: any) => setStaff(data ?? []));
  }, [sop.id, canEdit, canSeeReads]);

  const confirmRead = async () => {
    const { error } = await db.from("sop_reads").insert({ sop_id: sop.id, user_id: userId, version: sop.version });
    if (error) return toast.error(error.message);
    toast.success("Marked as read"); onChanged();
  };
  const publish = async () => {
    const note = window.prompt("What changed in this version?", sop.version ? "" : "First version");
    if (note === null) return;
    const { error } = await db.rpc("publish_sop", { _id: sop.id, _note: note });
    if (error) return toast.error(error.message);
    toast.success("Published — everyone will be asked to read it"); onChanged();
  };
  const setStatus = async (status: string) => {
    const { error } = await db.from("sops").update({ status }).eq("id", sop.id);
    if (error) return toast.error(error.message);
    onChanged();
  };
  const restore = async (v: Version) => {
    if (!window.confirm(`Restore version ${v.version}? It becomes a draft you can publish.`)) return;
    const { error } = await db.from("sops").update({ title: v.title, summary: v.summary, owner_role: v.owner_role, sections: v.sections, status: "draft" }).eq("id", sop.id);
    if (error) return toast.error(error.message);
    toast.success("Restored as draft"); onChanged();
  };
  const readIds = new Set(reads.map((r) => r.user_id));

  return (
    <article className="max-w-3xl">
      <button onClick={onBack} className="mb-4 text-sm text-ink-soft hover:text-signal">← All procedures</button>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="eyebrow text-[10px] text-signal">{deptLabel(sop.department)}</span>
        <StatusChip tone={sop.status === "published" ? "done" : sop.status === "draft" ? "warn" : "neutral"} value={`${sop.status}${sop.version ? ` · v${sop.version}` : ""}`} />
      </div>
      <h2 className="display text-2xl md:text-4xl">{sop.title}</h2>
      {sop.summary && <p className="mt-2 text-ink-soft">{sop.summary}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {sop.status === "published" && (read
          ? <span className="inline-flex items-center gap-1.5 text-sm text-acc-lime"><CheckCircle2 className="h-4 w-4" />You've read this version</span>
          : <button className={`${btn} bg-signal text-paper`} onClick={confirmRead}>I have read this version</button>)}
        {canEdit && <>
          <button className={`${btn} border border-rule`} onClick={onEdit}>Edit</button>
          <button className={`${btn} border border-signal text-signal`} onClick={publish}>Publish{sop.version ? " new version" : ""}</button>
          {sop.status !== "archived" ? <button className={`${btn} border border-rule text-ink-soft`} onClick={() => setStatus("archived")}>Archive</button>
            : <button className={`${btn} border border-rule`} onClick={() => setStatus("draft")}>Unarchive</button>}
        </>}
      </div>

      <dl className="mt-6 grid gap-3 rounded-xl border border-rule bg-paper-raised p-5 text-sm sm:grid-cols-2">
        <div><dt className="eyebrow text-[10px] text-ink-faint">Owner</dt><dd>{sop.owner_role || "—"}</dd></div>
        <div><dt className="eyebrow text-[10px] text-ink-faint">When it applies</dt><dd className="text-ink-soft">{s.when || "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="eyebrow text-[10px] text-ink-faint">Purpose</dt><dd className="text-ink-soft">{s.purpose || "—"}</dd></div>
        {s.scope && <div className="sm:col-span-2"><dt className="eyebrow text-[10px] text-ink-faint">Scope</dt><dd className="text-ink-soft">{s.scope}</dd></div>}
      </dl>

      <List title="Before you start" items={s.prerequisites} />

      {!!s.steps?.length && (
        <section className="mt-6">
          <h3 className="eyebrow mb-3 text-ink-faint">Steps</h3>
          <ol className="space-y-3">
            {s.steps.map((st, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-rule p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-acc-violet-soft text-xs font-semibold text-acc-violet">{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-medium">{st.title}</div>
                  {st.detail && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{st.detail}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
                    {st.who && <span>Who: <b className="text-ink-soft">{st.who}</b></span>}
                    {st.where && <span>Where: <b className="text-ink-soft">{st.where}</b></span>}
                    {st.output && <span>Done when: <b className="text-ink-soft">{st.output}</b></span>}
                    {st.time && <span>Time limit: <b className="text-ink-soft">{st.time}</b></span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <List title="Approvals & sign-offs" items={s.approvals} />
      <List title="Common mistakes" items={s.mistakes} />
      {s.escalation && <section className="mt-6"><h3 className="eyebrow mb-2 text-ink-faint">If something goes wrong</h3><p className="text-sm text-ink-soft">{s.escalation}</p></section>}
      <List title="Templates & checklists" items={s.templates} />
      <List title="Related SOPs" items={s.related} />

      {canSeeReads && sop.status === "published" && (
        <section className="mt-8 rounded-xl border border-rule p-5">
          <h3 className="eyebrow mb-2 text-ink-faint">Who has read v{sop.version}</h3>
          <p className="mb-3 text-sm">{readIds.size} of {staff.length} team members</p>
          <div className="flex flex-wrap gap-1.5">
            {staff.map((p) => <span key={p.user_id} className={`rounded-full px-2.5 py-1 text-[11px] ${readIds.has(p.user_id) ? "bg-acc-lime/15 text-acc-lime" : "bg-paper-sunken text-ink-faint"}`}>{p.name}</span>)}
          </div>
        </section>
      )}

      {(canEdit || canSeeReads) && versions.length > 0 && (
        <section className="mt-6 rounded-xl border border-rule p-5">
          <h3 className="eyebrow mb-3 text-ink-faint">Version history</h3>
          <ul className="space-y-2 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3">
                <b>v{v.version}</b>
                <span className="text-ink-faint">{new Date(v.created_at).toLocaleDateString()}</span>
                <span className="text-ink-soft">{v.change_note || "—"}</span>
                {canEdit && <button className="ml-auto text-xs text-signal" onClick={() => restore(v)}>Restore</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Lines({ label, value, onChange }: { label: string; value?: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-soft">{label} <span className="text-ink-faint">(one per line)</span></span>
      <textarea className={`${input} min-h-[90px]`} value={(value ?? []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </label>
  );
}

function SopEditor({ sop, onClose, onSaved }: { sop: Sop; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Sop>(sop);
  const s = f.sections;
  const setS = (patch: Partial<SopSections>) => setF({ ...f, sections: { ...s, ...patch } });
  const steps = s.steps ?? [];
  const setStep = (i: number, patch: Partial<SopStep>) => setS({ steps: steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: number) => { const n = [...steps]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setS({ steps: n }); };
  const clean = (a?: string[]) => (a ?? []).map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    if (!f.title.trim()) return toast.error("Give it a title");
    const sections: SopSections = { ...s, prerequisites: clean(s.prerequisites), approvals: clean(s.approvals), mistakes: clean(s.mistakes), templates: clean(s.templates), related: clean(s.related), steps: steps.filter((x) => x.title.trim()) };
    const row = { department: f.department, title: f.title.trim(), summary: f.summary, owner_role: f.owner_role, sections, sort: f.sort };
    const res = f.id ? await db.from("sops").update(row).eq("id", f.id).select("id").single() : await db.from("sops").insert(row).select("id").single();
    if (res.error) return toast.error(res.error.message);
    toast.success(f.status === "published" ? "Saved — publish a new version so the team sees it" : "Saved as draft");
    onSaved(res.data.id);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader eyebrow="SOP editor" title={f.id ? "Edit SOP." : "New SOP."} lede="Saved changes stay private until you publish a new version." />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Department</span>
          <select className={input} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{SOP_DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block text-ink-soft">Owner (position)</span><input className={input} value={f.owner_role ?? ""} onChange={(e) => setF({ ...f, owner_role: e.target.value })} /></label>
      </div>
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">Title</span><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">Summary</span><textarea className={input} value={f.summary ?? ""} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">Purpose</span><textarea className={input} value={s.purpose ?? ""} onChange={(e) => setS({ purpose: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">Scope</span><textarea className={input} value={s.scope ?? ""} onChange={(e) => setS({ scope: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">When it applies</span><input className={input} value={s.when ?? ""} onChange={(e) => setS({ when: e.target.value })} /></label>
      <Lines label="Before you start" value={s.prerequisites} onChange={(v) => setS({ prerequisites: v })} />

      <div>
        <div className="mb-2 text-sm text-ink-soft">Steps</div>
        <div className="space-y-3">
          {steps.map((st, i) => (
            <div key={i} className="rounded-lg border border-rule p-3">
              <div className="mb-2 flex items-center gap-2">
                <b className="text-sm">{i + 1}.</b>
                <input className={input} placeholder="Step title" value={st.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                <button aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button aria-label="Remove step" onClick={() => setS({ steps: steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-signal" /></button>
              </div>
              <textarea className={`${input} mb-2`} placeholder="Detail — exactly how to do it" value={st.detail ?? ""} onChange={(e) => setStep(i, { detail: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-4">
                <input className={input} placeholder="Who" value={st.who ?? ""} onChange={(e) => setStep(i, { who: e.target.value })} />
                <input className={input} placeholder="Where in Site 99" value={st.where ?? ""} onChange={(e) => setStep(i, { where: e.target.value })} />
                <input className={input} placeholder="Done when" value={st.output ?? ""} onChange={(e) => setStep(i, { output: e.target.value })} />
                <input className={input} placeholder="Time limit" value={st.time ?? ""} onChange={(e) => setStep(i, { time: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        <button className={`${btn} mt-2 border border-rule`} onClick={() => setS({ steps: [...steps, { title: "" }] })}><Plus className="h-3.5 w-3.5" />Add step</button>
      </div>

      <Lines label="Approvals & sign-offs" value={s.approvals} onChange={(v) => setS({ approvals: v })} />
      <Lines label="Common mistakes" value={s.mistakes} onChange={(v) => setS({ mistakes: v })} />
      <label className="block text-sm"><span className="mb-1 block text-ink-soft">If something goes wrong (escalation)</span><textarea className={input} value={s.escalation ?? ""} onChange={(e) => setS({ escalation: e.target.value })} /></label>
      <Lines label="Templates & checklists" value={s.templates} onChange={(v) => setS({ templates: v })} />
      <Lines label="Related SOPs" value={s.related} onChange={(v) => setS({ related: v })} />

      <div className="flex gap-2 pt-2">
        <button className={`${btn} bg-signal text-paper`} onClick={save}>Save</button>
        <button className={`${btn} border border-rule`} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
