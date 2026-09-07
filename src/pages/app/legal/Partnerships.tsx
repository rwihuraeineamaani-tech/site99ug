import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { PARTNERSHIP_STATUSES, field, niceDate, solidBtn } from "@/lib/legal";

type Partnership = {
  id: string;
  name: string;
  partner_contact: string | null;
  terms: string | null;
  split_kind: string;
  split_value: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  owner_user_id: string | null;
  notes: string | null;
};

type Member = { user_id: string; display_name: string | null; email: string };

export default function Partnerships() {
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canWrite = isLeadership || canSeeFinance || has("legal");
  const canSeeMoney = canWrite;

  const [rows, setRows] = useState<Partnership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    partner_contact: "",
    terms: "",
    split_kind: "percent",
    split_value: "",
    starts_on: "",
    ends_on: "",
    status: "active",
    owner_user_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      supabase.from("partnerships").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("user_id, display_name, email"),
    ]);
    setRows((p.data as Partnership[]) ?? []);
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
    if (!form.name.trim()) return toast.error("Give the partner a name.");
    setBusy(true);
    const { error } = await supabase.from("partnerships").insert({
      name: form.name.trim(),
      partner_contact: form.partner_contact.trim() || null,
      terms: form.terms.trim() || null,
      split_kind: form.split_kind,
      split_value: form.split_value ? Number(form.split_value) : null,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      status: form.status,
      owner_user_id: form.owner_user_id || null,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Partnership saved.");
    setOpen(false);
    setForm({ ...form, name: "", partner_contact: "", terms: "", split_value: "", notes: "" });
    load();
  };

  const setStatusOn = async (id: string, status: string) => {
    const { error } = await supabase.from("partnerships").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <SectionPage
      eyebrow="Legal"
      title="Partnerships."
      lede="Who we work with, on what terms, and what each side owes."
      path="/app/legal/partnerships"
      actions={
        canWrite ? (
          <button className={solidBtn} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "New partnership"}
          </button>
        ) : undefined
      }
    >
      {open && canWrite && (
        <section className="mb-10 surface rounded-2xl p-5 md:p-6">
          <SectionHeading index="00" title="Add a partnership" hint="Terms and the split" />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs text-ink-soft">
              Partner
              <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Their contact
              <input
                className={field}
                value={form.partner_contact}
                onChange={(e) => setForm({ ...form, partner_contact: e.target.value })}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Owner here
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
              Split
              <select className={field} value={form.split_kind} onChange={(e) => setForm({ ...form, split_kind: e.target.value })}>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              {form.split_kind === "percent" ? "Our share (%)" : "Our share (UGX)"}
              <input
                inputMode="numeric"
                className={field}
                value={form.split_value}
                onChange={(e) => setForm({ ...form, split_value: e.target.value })}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Status
              <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {PARTNERSHIP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              Starts
              <input type="date" className={field} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Ends
              <input type="date" className={field} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft md:col-span-3">
              Terms — what each side owes
              <textarea rows={3} className={field} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </label>
          </div>
          <div className="mt-5">
            <button className={solidBtn} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save partnership"}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : !rows.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">No partnerships recorded yet.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="surface card-lift rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-ink-soft">{r.partner_contact || "No contact on file"}</div>
                </div>
                <StatusChip value={r.status} />
              </div>
              <div className="mt-3 text-xs text-ink-soft">
                {niceDate(r.starts_on)} → {niceDate(r.ends_on)} · Owner: {memberName(r.owner_user_id)}
              </div>
              {canSeeMoney && r.split_value != null && (
                <div className="mt-2 text-sm num">
                  Our share: {r.split_kind === "percent" ? `${r.split_value}%` : `UGX ${Number(r.split_value).toLocaleString("en-UG")}`}
                </div>
              )}
              {r.terms && <p className="mt-3 text-sm text-ink-soft whitespace-pre-wrap">{r.terms}</p>}
              {canWrite && (
                <select
                  aria-label="Change status"
                  className="mt-4 press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs focus-ring"
                  value={r.status}
                  onChange={(e) => setStatusOn(r.id, e.target.value)}
                >
                  {PARTNERSHIP_STATUSES.map((s) => (
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
