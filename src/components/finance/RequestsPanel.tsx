import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading, StatusChip, Money, FilterBar, SelectFilter } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  EXPENSE_CATEGORIES,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  dayLabel,
} from "@/lib/finance";

export type CashRequest = {
  id: string;
  requester: string;
  amount_ugx: number;
  purpose: string;
  category: string;
  needed_on: string | null;
  resident_id: string | null;
  attachment_path: string | null;
  status: string;
  md_approved_at: string | null;
  founder_approved_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill =
  "press rounded-full border px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50 border-rule bg-paper-raised";

export default function RequestsPanel({
  index = "01",
  onChanged,
}: {
  index?: string;
  onChanged?: () => void;
}) {
  const { userId, isStaff, isLeadership, canSeeFinance, has } = useMyRoles();
  const isMd = has("admin", "founder", "managing_director");
  const isFounder = has("admin", "founder");

  const [rows, setRows] = useState<CashRequest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState("general");
  const [neededOn, setNeededOn] = useState("");
  const [residentId, setResidentId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const [{ data: reqs }, { data: team }, { data: res }] = await Promise.all([
      supabase.from("cash_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase.rpc("resident_options"),
    ]);
    setRows((reqs as CashRequest[]) ?? []);
    const map: Record<string, string> = {};
    (team ?? []).forEach((t) => {
      map[t.user_id] = t.display_name || t.email || "Team member";
    });
    setNames(map);
    setResidents(((res as { id: string; name: string }[]) ?? []).map((r) => ({ id: r.id, name: r.name })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const value = Number(amount.replace(/[^\d]/g, ""));
    if (!value || value <= 0) return toast.error("Enter the amount you need.");
    if (!purpose.trim()) return toast.error("Say what the money is for.");
    setBusy(true);
    let path: string | null = null;
    if (file && userId) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      const key = `${userId}/${crypto.randomUUID()}-${clean}`;
      const { error: upErr } = await supabase.storage.from("finance-files").upload(key, file);
      if (upErr) {
        setBusy(false);
        return toast.error(upErr.message);
      }
      path = key;
    }
    const { error } = await supabase.from("cash_requests").insert({
      requester: userId!,
      amount_ugx: value,
      purpose: purpose.trim(),
      category,
      needed_on: neededOn || null,
      resident_id: residentId || null,
      attachment_path: path,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setPurpose("");
    setNeededOn("");
    setResidentId("");
    setFile(null);
    toast.success("Sent to the Managing Director.");
    load();
    onChanged?.();
  };

  const approve = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("approve_cash_request", { _id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Approved.");
    load();
    onChanged?.();
  };

  const decline = async (id: string) => {
    const reason = window.prompt("Why is this being declined?");
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.rpc("decline_cash_request", { _id: id, _reason: reason });
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
    onChanged?.();
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("finance-files").createSignedUrl(path, 120);
    if (error || !data) return toast.error("Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const shown = useMemo(() => {
    if (view === "mine") return rows.filter((r) => r.requester === userId);
    if (view === "waiting")
      return rows.filter(
        (r) =>
          (r.status === "submitted" && isMd) ||
          (r.status === "md_approved" && isFounder) ||
          (r.status === "approved" && (canSeeFinance || isLeadership))
      );
    if (view === "open") return rows.filter((r) => ["submitted", "md_approved", "approved"].includes(r.status));
    return rows;
  }, [rows, view, userId, isMd, isFounder, canSeeFinance, isLeadership]);

  return (
    <section>
      {isStaff && (
        <>
          <SectionHeading index={index} title="Ask for cash" hint="Goes to the MD, then a founder" />
          <div className="surface rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">How much (UGX)</span>
              <input className={field} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250000" />
            </label>
            <label className="text-sm lg:col-span-2">
              <span className="eyebrow text-ink-faint">What it is for</span>
              <input className={field} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Transport and props for Saturday's shoot" />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Category</span>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Needed by</span>
              <input className={field} type="date" value={neededOn} onChange={(e) => setNeededOn(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">For a client (optional)</span>
              <select className={field} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
                <option value="">—</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Quote or receipt (optional)</span>
              <input className={field} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex items-end">
              <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring w-full" disabled={busy} onClick={submit}>
                Send request
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mt-10">
        <SectionHeading index={index === "01" ? "02" : index} title="Requests" hint={`${shown.length} shown`} />
        <FilterBar>
          <SelectFilter
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All" },
              { value: "waiting", label: "Waiting on me" },
              { value: "open", label: "Still open" },
              { value: "mine", label: "Mine" },
            ]}
          />
        </FilterBar>
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing here.</p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {shown.map((r) => {
              const canApprove =
                (r.status === "submitted" && isMd) || (r.status === "md_approved" && isFounder);
              return (
                <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Money amount={r.amount_ugx} className="font-semibold" />
                  <span className="text-sm min-w-0 truncate">{r.purpose}</span>
                  <StatusChip value={REQUEST_STATUS_LABEL[r.status] ?? r.status} tone={REQUEST_STATUS_TONE[r.status]} />
                  <span className="text-[11px] text-ink-faint">
                    {names[r.requester] ?? "Team member"} · {dayLabel(r.created_at)}
                    {r.needed_on ? ` · needed ${dayLabel(r.needed_on)}` : ""}
                  </span>
                  {r.decline_reason && <span className="text-[11px] text-signal">“{r.decline_reason}”</span>}
                  <div className="ml-auto flex items-center gap-2">
                    {r.attachment_path && (
                      <button className={pill} onClick={() => openFile(r.attachment_path!)}>
                        File
                      </button>
                    )}
                    {canApprove && (
                      <>
                        <button className="ctl ctl-solid eyebrow px-3 py-1.5 focus-ring" disabled={busy} onClick={() => approve(r.id)}>
                          Approve
                        </button>
                        <button className={pill} disabled={busy} onClick={() => decline(r.id)}>
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
