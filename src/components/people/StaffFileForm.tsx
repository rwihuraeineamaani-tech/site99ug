import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SECTIONS, EMPLOYMENT, DOC_KINDS, completeness, statusLabel, loadFile, saveRow, uploadDoc, openDoc, requiredDocs, type Row, type FieldDef } from "@/lib/staffProfile";
import { supabase } from "@/integrations/supabase/client";

function Field({ f, value, onChange, disabled }: { f: FieldDef; value: unknown; onChange: (v: string) => void; disabled?: boolean }) {
  const v = value === null || value === undefined ? "" : String(value);
  const common = { id: f.key, disabled, className: "field w-full", value: v };
  return (
    <label className="grid gap-1 text-sm" htmlFor={f.key}>
      <span className="text-xs text-ink-soft">{f.label}{f.required && <span className="text-signal"> *</span>}</span>
      {f.type === "select" ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {f.options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : f.type === "textarea" ? (
        <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={f.type ?? "text"} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.hint && <span className="text-[11px] text-ink-faint">{f.hint}</span>}
    </label>
  );
}

/** Edit a staff file. `mode="self"` for My Settings, `mode="hr"` for HR editing someone else. */
export default function StaffFileForm({ userId, mode, canSeePrivate = true, canEditEmployment = false }: { userId: string; mode: "self" | "hr" | "view"; canSeePrivate?: boolean; canEditEmployment?: boolean }) {
  const [profile, setProfile] = useState<Row>({});
  const [priv, setPriv] = useState<Row>({});
  const [emp, setEmp] = useState<Row>({});
  const [docs, setDocs] = useState<{ id: string; kind: string; file_path: string; file_name: string | null; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [docKind, setDocKind] = useState(DOC_KINDS[0]);
  const readOnly = mode === "view";

  const load = async () => {
    const f = await loadFile(userId);
    setProfile(f.profile ?? { nationality: "Ugandan" });
    setPriv(f.priv ?? {});
    setEmp(f.employment ?? {});
    setDocs(f.docs);
  };
  useEffect(() => { load(); }, [userId]);

  const nat = (profile.nationality as string) ?? "Ugandan";
  const comp = completeness(profile, priv, docs, canSeePrivate, emp);
  const strip = (r: Row) => { const { user_id, created_at, updated_at, ...rest } = r; void user_id; void created_at; void updated_at; return rest; };

  const saveAll = async () => {
    setBusy(true);
    try {
      await saveRow("staff_profiles", userId, strip(profile));
      if (canSeePrivate) await saveRow("staff_private", userId, strip(priv));
      if (canEditEmployment) await saveRow("staff_employment", userId, { ...strip(emp), updated_by: (await supabase.auth.getUser()).data.user?.id });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    try { await uploadDoc(userId, docKind, file); toast.success("Uploaded"); load(); } catch (e) { toast.error((e as Error).message); }
  };
  const removeDoc = async (id: string, path: string) => {
    if (!confirm("Remove this document?")) return;
    await supabase.storage.from("staff-docs").remove([path]);
    await supabase.from("staff_documents" as never).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="surface rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">Staff file: <span className={comp.status === "incomplete" ? "text-destructive" : comp.status === "partly" ? "text-signal" : "text-primary"}>{statusLabel(comp.status)}</span> · {comp.pct}%</span>
          <span className="text-xs text-ink-soft">{comp.jobType ?? "Job type not set"} · {nat && !["", "ugandan"].includes(nat.toLowerCase()) ? "Foreign national" : "Ugandan"}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-signal" style={{ width: `${comp.pct}%` }} /></div>
        {comp.critical.length > 0 && <p className="mt-2 text-xs text-destructive">Needed first: {comp.critical.join(", ")}</p>}
        {comp.minor.length > 0 && <p className="mt-1 text-xs text-ink-soft">Minor — still to hand in: {comp.minor.join(", ")}</p>}
        <p className="mt-1 text-[11px] text-ink-soft">{comp.jobNote}</p>
      </div>

      {SECTIONS.filter((s) => (!s.show || s.show(nat)) && (s.table !== "staff_private" || canSeePrivate)).map((s) => {
        const src = s.table === "staff_private" ? priv : profile;
        const set = s.table === "staff_private" ? setPriv : setProfile;
        return (
          <section key={s.id} className="surface rounded-xl p-4">
            <h3 className="display text-base">{s.title}</h3>
            {s.hint && <p className="text-xs text-ink-faint">{s.hint}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {s.fields.map((f) => <Field key={f.key} f={f} value={src[f.key]} disabled={readOnly} onChange={(v) => set((r) => ({ ...r, [f.key]: v }))} />)}
            </div>
          </section>
        );
      })}

      <section className="surface rounded-xl p-4">
        <h3 className="display text-base">Employment</h3>
        <p className="text-xs text-ink-faint">{canEditEmployment ? "HR keeps these up to date." : "Filled in by HR."}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {EMPLOYMENT.map((f) => <Field key={f.key} f={f} value={emp[f.key]} disabled={!canEditEmployment} onChange={(v) => setEmp((r) => ({ ...r, [f.key]: v }))} />)}
        </div>
      </section>

      {canSeePrivate && (
        <section className="surface rounded-xl p-4">
          <h3 className="display text-base">Documents</h3>
          <p className="text-xs text-ink-faint">Required for you: {requiredDocs(nat, emp.contract_type as string).join(", ")}. Private to you and HR.</p>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select className="field" value={docKind} onChange={(e) => setDocKind(e.target.value)}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              <label className="press cursor-pointer rounded-full border border-rule px-3 py-1.5 text-sm">Upload file<input type="file" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} /></label>
            </div>
          )}
          <ul className="mt-3 divide-y divide-rule text-sm">
            {docs.length === 0 && <li className="py-2 text-ink-soft">No documents yet.</li>}
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span><span className="font-medium">{d.kind}</span> <span className="text-xs text-ink-soft">{d.file_name}</span></span>
                <span className="flex gap-3 text-xs">
                  <button className="underline" onClick={() => openDoc(d.file_path).catch((e) => toast.error(e.message))}>Open</button>
                  {!readOnly && <button className="underline text-signal" onClick={() => removeDoc(d.id, d.file_path)}>Remove</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!readOnly && <button disabled={busy} onClick={saveAll} className="press rounded-full bg-signal px-5 py-2 text-sm font-medium text-background disabled:opacity-50">{busy ? "Saving…" : "Save file"}</button>}
    </div>
  );
}
