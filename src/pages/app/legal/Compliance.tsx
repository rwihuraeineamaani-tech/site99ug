import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { COMPLIANCE_STATUSES, dueLabel, dueTone, field, niceDate, solidBtn } from "@/lib/legal";

type Item = {
  id: string;
  name: string;
  authority: string | null;
  reference_no: string | null;
  renews_on: string | null;
  owner_user_id: string | null;
  status: string;
  notes: string | null;
};

type Member = { user_id: string; display_name: string | null; email: string };

export default function Compliance() {
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canWrite = isLeadership || canSeeFinance || has("legal");

  const [rows, setRows] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    authority: "",
    reference_no: "",
    renews_on: "",
    owner_user_id: "",
    status: "active",
    notes: "",
  });

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      supabase.from("compliance_items").select("*").order("renews_on", { ascending: true, nullsFirst: false }),
      supabase.from("team_members").select("user_id, display_name, email"),
    ]);
    setRows((c.data as Item[]) ?? []);
    setMembers((m.data as Member[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (id: string | null) => {
    if (!id) return "—";
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || "—";
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name the licence or obligation.");
    setBusy(true);
    const { error } = await supabase.from("compliance_items").insert({
      name: form.name.trim(),
      authority: form.authority.trim() || null,
      reference_no: form.reference_no.trim() || null,
      renews_on: form.renews_on || null,
      owner_user_id: form.owner_user_id || null,
      status: form.status,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
    setForm({ ...form, name: "", authority: "", reference_no: "", renews_on: "", notes: "" });
    load();
  };

  const patch = async (id: string, values: Partial<Item>) => {
    const { error } = await supabase.from("compliance_items").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <SectionPage
      eyebrow="Legal"
      title="Compliance."
      lede="Licences, registrations and anything that has to be renewed on time."
      path="/app/legal/compliance"
    >
      {canWrite && (
        <section className="mb-10 surface rounded-2xl p-5 md:p-6">
          <SectionHeading index="00" title="Add an obligation" hint="Renewal date and owner" />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs text-ink-soft">
              Name
              <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Authority
              <input className={field} value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Reference number
              <input
                className={field}
                value={form.reference_no}
                onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Renews on
              <input type="date" className={field} value={form.renews_on} onChange={(e) => setForm({ ...form, renews_on: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Owner
              <select
                className={field}
                value={form.owner_user_id}
                onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}
              >
                <option value="">Nobody yet</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              Status
              <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {COMPLIANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft md:col-span-3">
              Notes
              <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="mt-5">
            <button className={solidBtn} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : !rows.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">Nothing to keep an eye on yet.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-semibold text-sm">{r.name}</div>
                <div className="text-xs text-ink-soft">
                  {r.authority || "—"}
                  {r.reference_no ? ` · ${r.reference_no}` : ""}
                </div>
              </div>
              <span className="text-xs text-ink-soft w-32">{niceDate(r.renews_on)}</span>
              <StatusChip value={dueLabel(r.renews_on)} tone={dueTone(r.renews_on)} />
              <span className="text-xs text-ink-soft w-32 truncate">{memberName(r.owner_user_id)}</span>
              <StatusChip value={r.status} />
              {canWrite && (
                <select
                  aria-label="Change status"
                  className="press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs focus-ring"
                  value={r.status}
                  onChange={(e) => patch(r.id, { status: e.target.value })}
                >
                  {COMPLIANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}
