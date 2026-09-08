import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip, SearchInput, SelectFilter, FilterBar, Money } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  PARTY_KINDS,
  field,
  ghostBtn,
  niceDate,
  solidBtn,
  dueLabel,
  dueTone,
} from "@/lib/legal";

type Contract = {
  id: string;
  party_kind: string;
  party_name: string;
  title: string;
  contract_type: string;
  starts_on: string | null;
  ends_on: string | null;
  value_ugx: number | null;
  status: string;
  owner_user_id: string | null;
  file_path: string | null;
  notes: string | null;
  resident_id: string | null;
  source: "legal" | "resident";
};

const RESIDENT_STATUSES = ["active", "archived"] as const;

type Member = { user_id: string; display_name: string | null; email: string };

export default function Contracts() {
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canWrite = isLeadership || canSeeFinance || has("legal");
  const canSeeMoney = isLeadership || canSeeFinance || has("legal");

  const [rows, setRows] = useState<Contract[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    party_kind: "client",
    party_name: "",
    title: "",
    contract_type: "service",
    starts_on: "",
    ends_on: "",
    value_ugx: "",
    status: "draft",
    owner_user_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const [c, m, rc, res] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, party_kind, party_name, title, contract_type, starts_on, ends_on, value_ugx, status, owner_user_id, file_path, notes, resident_id"
        )
        .order("ends_on", { ascending: true, nullsFirst: false }),
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase
        .from("resident_contracts")
        .select("id, resident_id, title, file_path, starts_on, ends_on, value_ugx, status, notes")
        .order("ends_on", { ascending: true, nullsFirst: false }),
      supabase.from("residents").select("id, name"),
    ]);
    const names = new Map(((res.data as { id: string; name: string }[]) ?? []).map((r) => [r.id, r.name]));
    const legal = ((c.data as Omit<Contract, "source">[]) ?? []).map((r) => ({ ...r, source: "legal" as const }));
    const resident = ((rc.data as {
      id: string;
      resident_id: string;
      title: string;
      file_path: string | null;
      starts_on: string | null;
      ends_on: string | null;
      value_ugx: number | null;
      status: string;
      notes: string | null;
    }[]) ?? []).map((r) => ({
      id: r.id,
      party_kind: "resident",
      party_name: names.get(r.resident_id) ?? "Resident",
      title: r.title,
      contract_type: "retainer",
      starts_on: r.starts_on,
      ends_on: r.ends_on,
      value_ugx: r.value_ugx,
      status: r.status,
      owner_user_id: null,
      file_path: r.file_path,
      notes: r.notes,
      resident_id: r.resident_id,
      source: "resident" as const,
    }));
    setRows([...legal, ...resident]);
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (kind !== "all" && r.party_kind !== kind) return false;
      if (!needle) return true;
      return `${r.title} ${r.party_name}`.toLowerCase().includes(needle);
    });
  }, [rows, q, status, kind]);


  const save = async () => {
    if (!form.title.trim() || !form.party_name.trim()) return toast.error("Give it a title and the other party.");
    setBusy(true);
    let file_path: string | null = null;
    if (file) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      const path = `contracts/${crypto.randomUUID()}-${clean}`;
      const up = await supabase.storage.from("legal-files").upload(path, file);
      if (up.error) {
        setBusy(false);
        return toast.error(up.error.message);
      }
      file_path = path;
    }
    const { error } = await supabase.from("contracts").insert({
      party_kind: form.party_kind,
      party_name: form.party_name.trim(),
      title: form.title.trim(),
      contract_type: form.contract_type,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      value_ugx: form.value_ugx ? Math.round(Number(form.value_ugx)) : null,
      status: form.status,
      owner_user_id: form.owner_user_id || null,
      notes: form.notes.trim() || null,
      file_path,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contract saved.");
    setOpen(false);
    setFile(null);
    setForm({ ...form, party_name: "", title: "", value_ugx: "", notes: "", starts_on: "", ends_on: "" });
    load();
  };

  const setStatusOn = async (id: string, value: string) => {
    const { error } = await supabase.from("contracts").update({ status: value }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const openFile = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("legal-files").createSignedUrl(path, 120);
    if (error || !data) return toast.error(error?.message ?? "Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <SectionPage
      eyebrow="Legal"
      title="Contracts."
      lede="Every agreement in one register — residents, clients, suppliers, partners, freelancers and staff."
      path="/app/legal/contracts"
      actions={
        canWrite ? (
          <button className={solidBtn} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "New contract"}
          </button>
        ) : undefined
      }
    >
      {open && canWrite && (
        <section className="mb-10 surface rounded-2xl p-5 md:p-6">
          <SectionHeading index="00" title="Add a contract" hint="Details and the signed file" />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs text-ink-soft">
              Title
              <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Other party
              <input
                className={field}
                value={form.party_name}
                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Who they are
              <select className={field} value={form.party_kind} onChange={(e) => setForm({ ...form, party_kind: e.target.value })}>
                {PARTY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              Type
              <select
                className={field}
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
              >
                {CONTRACT_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k}
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
            {canSeeMoney && (
              <label className="text-xs text-ink-soft">
                Value (UGX)
                <input
                  inputMode="numeric"
                  className={field}
                  value={form.value_ugx}
                  onChange={(e) => setForm({ ...form, value_ugx: e.target.value })}
                />
              </label>
            )}
            <label className="text-xs text-ink-soft">
              Status
              <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {CONTRACT_STATUSES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
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
            <label className="text-xs text-ink-soft md:col-span-2">
              Notes
              <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Signed file
              <input type="file" className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="mt-5">
            <button className={solidBtn} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save contract"}
            </button>
          </div>
        </section>
      )}

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search contracts…" />
        <SelectFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "Any status" }, ...CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
        <SelectFilter
          label="Party"
          value={kind}
          onChange={setKind}
          options={[{ value: "all", label: "Any party" }, ...PARTY_KINDS.map((s) => ({ value: s, label: s }))]}
        />
      </FilterBar>

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : !shown.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">No contracts here yet.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {shown.map((r) => (
            <li key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-[14rem] flex-1">
                <div className="font-semibold text-sm">{r.title}</div>
                <div className="text-xs text-ink-soft">
                  {r.party_name} · {r.party_kind} · {r.contract_type}
                </div>
              </div>
              <div className="text-xs text-ink-soft w-40">
                {niceDate(r.starts_on)} → {niceDate(r.ends_on)}
              </div>
              <StatusChip value={dueLabel(r.ends_on)} tone={dueTone(r.ends_on)} />
              {canSeeMoney && (
                <div className="text-sm num w-28 text-right">{r.value_ugx ? <Money amount={r.value_ugx} /> : "—"}</div>
              )}
              <div className="text-xs text-ink-soft w-32 truncate">{memberName(r.owner_user_id)}</div>
              <StatusChip value={r.status} />
              {r.file_path && (
                <button className={ghostBtn} onClick={() => openFile(r.file_path)}>
                  Open file
                </button>
              )}
              {canWrite && (
                <select
                  aria-label="Change status"
                  className="press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs focus-ring"
                  value={r.status}
                  onChange={(e) => setStatusOn(r.id, e.target.value)}
                >
                  {CONTRACT_STATUSES.map((s) => (
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
