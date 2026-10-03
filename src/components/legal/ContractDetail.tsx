import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Money, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { CONTRACT_LABEL, CONTRACT_TONE, loadContractMoney, type ContractMoney } from "@/lib/contractLifecycle";
import { field, ghostBtn, niceDate, solidBtn } from "@/lib/legal";

export type ContractRow = {
  id: string;
  resident_id: string;
  title: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  months: number | null;
  monthly_retainer_ugx: number | null;
  value_ugx: number | null;
  contract_type: string | null;
  services: Record<string, string> | null;
  payment_terms: string | null;
  invoice_day: number | null;
  due_days: number | null;
  notice_days: number | null;
  renewal_terms: string | null;
  vat_mode: string | null;
  legal_verified_at: string | null;
  legal_verified_by: string | null;
  client_signatory: string | null;
  site99_signatory: string | null;
  approval_state: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  return_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  notes: string | null;
  file_path: string | null;
};

export const APPROVAL_LABEL: Record<string, string> = {
  draft: "Draft, not sent for approval",
  submitted: "Waiting on a Founder",
  approved: "Approved",
  returned: "Sent back to Legal",
};
export const APPROVAL_TONE: Record<string, "neutral" | "pending" | "teal" | "stop"> = {
  draft: "neutral",
  submitted: "pending",
  approved: "teal",
  returned: "stop",
};

export const VAT_LABEL: Record<string, string> = {
  unknown: "Not confirmed yet",
  inclusive: "VAT included in the retainer (18%)",
  exclusive: "VAT added on top of the retainer (18%)",
  exempt: "No VAT on this contract",
};

/** Months between two dates, matching the database rule (half a month or more counts as a month). */
export function monthsBetween(s?: string | null, e?: string | null): number | null {
  if (!s || !e || e < s) return null;
  const a = new Date(`${s}T00:00:00`);
  const b = new Date(`${e}T00:00:00`);
  b.setDate(b.getDate() + 1);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  let d = b.getDate() - a.getDate();
  if (d < 0) {
    m -= 1;
    const prev = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    d += prev;
  }
  return Math.max(1, m + (d >= 15 ? 1 : 0));
}

const SERVICE_FIELDS: { key: string; label: string }[] = [
  { key: "deliverables", label: "Deliverables per month" },
  { key: "platforms", label: "Platforms" },
  { key: "shoot_days", label: "Shoot days per month" },
  { key: "extras", label: "Other services" },
];

const asText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ContractDetail({
  contractId,
  onClose,
  onChanged,
}: {
  contractId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { has, isLeadership, canSeeFinance } = useMyRoles();
  const isFounder = has("admin", "founder");
  const canEdit = isFounder || has("legal", "managing_director");
  const canSeeMoney = isLeadership || canSeeFinance || has("legal");

  const [c, setC] = useState<ContractRow | null>(null);
  const [client, setClient] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [money, setMoney] = useState<ContractMoney | null>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!contractId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("resident_contracts") as any).select("*").eq("id", contractId).maybeSingle();
    const row = data as ContractRow | null;
    setC(row);
    if (!row) return;
    const [r, tm] = await Promise.all([
      supabase.from("residents").select("name").eq("id", row.resident_id).maybeSingle(),
      supabase.from("team_members").select("user_id, display_name, email"),
    ]);
    setClient((r.data as { name: string } | null)?.name ?? "Client");
    setNames(
      Object.fromEntries(
        ((tm.data as { user_id: string; display_name: string | null; email: string }[]) ?? []).map((m) => [m.user_id, m.display_name || m.email])
      )
    );
    if (canSeeMoney) {
      const list = await loadContractMoney(row.resident_id);
      setMoney(list.find((x) => x.contract_id === row.id) ?? null);
    }
  }, [contractId, canSeeMoney]);

  useEffect(() => {
    setEdit(false);
    setNote("");
    load();
  }, [load]);

  const startEdit = () => {
    if (!c) return;
    setForm({
      title: c.title,
      contract_type: asText(c.contract_type),
      starts_on: asText(c.starts_on),
      ends_on: asText(c.ends_on),
      monthly_retainer_ugx: asText(c.monthly_retainer_ugx),
      payment_terms: asText(c.payment_terms),
      invoice_day: asText(c.invoice_day),
      due_days: asText(c.due_days),
      notice_days: asText(c.notice_days),
      renewal_terms: asText(c.renewal_terms),
      vat_mode: c.vat_mode || "unknown",
      client_signatory: asText(c.client_signatory),
      site99_signatory: asText(c.site99_signatory),
      notes: asText(c.notes),
      ...Object.fromEntries(SERVICE_FIELDS.map((s) => [`svc_${s.key}`, asText(c.services?.[s.key])])),
    });
    setEdit(true);
  };

  const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[^\d.]/g, ""))));

  const save = async () => {
    if (!c) return;
    if (!form.title?.trim()) return toast.error("Give the contract a title.");
    setBusy(true);
    const services = Object.fromEntries(
      SERVICE_FIELDS.map((s) => [s.key, form[`svc_${s.key}`]?.trim() ?? ""]).filter(([, v]) => v)
    );
    const months = monthsBetween(form.starts_on || null, form.ends_on || null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("resident_contracts") as any)
      .update({
        title: form.title.trim(),
        contract_type: form.contract_type || null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        months,
        monthly_retainer_ugx: num(form.monthly_retainer_ugx ?? ""),
        payment_terms: form.payment_terms || null,
        invoice_day: num(form.invoice_day ?? ""),
        due_days: num(form.due_days ?? ""),
        notice_days: num(form.notice_days ?? ""),
        renewal_terms: form.renewal_terms || null,
        vat_mode: form.vat_mode || "unknown",
        client_signatory: form.client_signatory || null,
        site99_signatory: form.site99_signatory || null,
        notes: form.notes || null,
        services,
      })
      .eq("id", c.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(c.approval_state === "approved" && !isFounder ? "Saved. The changes now wait for a Founder to approve." : "Contract details saved.");
    setEdit(false);
    load();
    onChanged?.();
  };

  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any).call(supabase, fn, args);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ok);
    setNote("");
    load();
    onChanged?.();
  };

  const formMonths = monthsBetween(form.starts_on || null, form.ends_on || null);
  const formMonthly = num(form.monthly_retainer_ugx ?? "") ?? 0;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-rule text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
  const input = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="text-xs text-ink-soft">
      {label}
      <input className={field} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} />
    </label>
  );

  return (
    <Dialog open={!!contractId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c?.title ?? "Contract"}</DialogTitle>
        </DialogHeader>
        {!c ? (
          <div className="h-40 animate-pulse surface rounded-xl" />
        ) : edit ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {input("title", "Title")}
              {input("contract_type", "Contract type", { placeholder: "Retainer, campaign, agent" })}
              {input("starts_on", "Starts", { type: "date" })}
              {input("ends_on", "Ends", { type: "date" })}
              {input("monthly_retainer_ugx", "Monthly retainer (UGX)", { inputMode: "numeric" })}
              <div className="text-xs text-ink-soft">
                Contract value
                <div className="mt-1.5 rounded-lg border border-rule bg-paper-sunken px-3 py-2 text-sm num">
                  {formMonths ? (
                    <>
                      <Money amount={formMonthly} /> x {formMonths} months = <Money amount={formMonthly * formMonths} />
                    </>
                  ) : (
                    "Set start and end dates"
                  )}
                </div>
              </div>
              {SERVICE_FIELDS.map((s) => input(`svc_${s.key}`, s.label))}
              {input("payment_terms", "Payment terms", { placeholder: "Paid monthly in advance" })}
              {input("invoice_day", "Invoice day of the month", { inputMode: "numeric" })}
              {input("due_days", "Days to pay", { inputMode: "numeric" })}
              {input("notice_days", "Notice period (days)", { inputMode: "numeric" })}
              {input("renewal_terms", "Renewal terms")}
              <label className="text-xs text-ink-soft">
                VAT
                <select className={field} value={form.vat_mode ?? "unknown"} onChange={(e) => setForm({ ...form, vat_mode: e.target.value })}>
                  {Object.entries(VAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              {input("client_signatory", "Client signatory")}
              {input("site99_signatory", "Site 99 signatory")}
              {input("notes", "Notes")}
            </div>
            {c.approval_state === "approved" && !isFounder && (
              <p className="text-xs text-ink-soft">This contract is approved. Saving changes sends it back to a Founder for approval.</p>
            )}
            <div className="flex gap-2">
              <button className={solidBtn} disabled={busy} onClick={save}>
                {busy ? "Saving…" : "Save details"}
              </button>
              <button className={ghostBtn} onClick={() => setEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusChip value={CONTRACT_LABEL[c.status] ?? c.status} tone={CONTRACT_TONE[c.status] ?? "neutral"} />
              <StatusChip value={APPROVAL_LABEL[c.approval_state] ?? c.approval_state} tone={APPROVAL_TONE[c.approval_state] ?? "neutral"} />
            </div>
            {c.approval_state === "returned" && c.return_note && (
              <p className="rounded-lg border border-signal/40 bg-signal/5 px-3 py-2 text-sm">Founder note: {c.return_note}</p>
            )}
            <div>
              <Row label="Client">{client}</Row>
              <Row label="Type">{c.contract_type || "Not set"}</Row>
              <Row label="Runs">
                {niceDate(c.starts_on)} to {niceDate(c.ends_on)}
              </Row>
              <Row label="Months">{c.months ?? "Not set"}</Row>
              <Row label="Monthly retainer">{c.monthly_retainer_ugx != null ? <Money amount={c.monthly_retainer_ugx} /> : "Not set"}</Row>
              <Row label="Contract value">
                {c.value_ugx != null ? (
                  <span className="num">
                    <Money amount={c.value_ugx} />
                    {c.months ? <span className="text-ink-faint"> ({c.months} months)</span> : null}
                  </span>
                ) : (
                  "Not set"
                )}
              </Row>
              {SERVICE_FIELDS.map((s) => (
                <Row key={s.key} label={s.label}>
                  {c.services?.[s.key] || "Not set"}
                </Row>
              ))}
              <Row label="Payment terms">{c.payment_terms || "Not set"}</Row>
              <Row label="Invoice day">{c.invoice_day ? `Day ${c.invoice_day} of each month` : "Not set"}</Row>
              <Row label="Days to pay">{c.due_days ?? "Not set"}</Row>
              <Row label="Notice period">{c.notice_days ? `${c.notice_days} days` : "Not set"}</Row>
              <Row label="Renewal terms">{c.renewal_terms || "Not set"}</Row>
              <Row label="VAT">{VAT_LABEL[c.vat_mode ?? "unknown"]}</Row>
              {c.vat_mode === "inclusive" && c.monthly_retainer_ugx ? (
                <Row label="Monthly before VAT">
                  <Money amount={Math.round(c.monthly_retainer_ugx / 1.18)} />
                </Row>
              ) : null}
              {c.vat_mode === "exclusive" && c.monthly_retainer_ugx ? (
                <Row label="Monthly with VAT">
                  <Money amount={Math.round(c.monthly_retainer_ugx * 1.18)} />
                </Row>
              ) : null}
              <Row label="Checked by Legal">{c.legal_verified_at ? `Yes, ${niceDate(c.legal_verified_at.slice(0, 10))}` : "Not yet"}</Row>
              <Row label="Client signatory">{c.client_signatory || "Not set"}</Row>
              <Row label="Site 99 signatory">{c.site99_signatory || "Not set"}</Row>
              {c.notes && <Row label="Notes">{c.notes}</Row>}
            </div>

            {money && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="surface rounded-xl p-3">
                  <div className="eyebrow text-ink-faint">Invoiced</div>
                  <Money amount={money.invoiced_ugx} />
                </div>
                <div className="surface rounded-xl p-3">
                  <div className="eyebrow text-ink-faint">Paid</div>
                  <Money amount={money.paid_ugx} />
                </div>
                <div className="surface rounded-xl p-3">
                  <div className="eyebrow text-ink-faint">Still owed</div>
                  <Money amount={money.outstanding_ugx} />
                </div>
              </div>
            )}

            <div className="text-xs text-ink-soft space-y-1">
              <div className="eyebrow text-ink-faint">Approval trail</div>
              <div>Drafted by {names[c.created_by ?? ""] ?? "someone on the team"}</div>
              {c.updated_by && <div>Last edited by {names[c.updated_by] ?? "a team member"}</div>}
              {c.submitted_at && (
                <div>
                  Sent for approval by {names[c.submitted_by ?? ""] ?? "Legal"} on {niceDate(c.submitted_at.slice(0, 10))}
                </div>
              )}
              {c.approved_at && (
                <div>
                  Approved by {names[c.approved_by ?? ""] ?? "a Founder"} on {niceDate(c.approved_at.slice(0, 10))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button className={ghostBtn} onClick={startEdit}>
                  Edit details
                </button>
              )}
              {canEdit && (
                <button
                  className={ghostBtn}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { data: u } = await supabase.auth.getUser();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await (supabase.from("resident_contracts") as any)
                      .update(c.legal_verified_at ? { legal_verified_at: null, legal_verified_by: null } : { legal_verified_at: new Date().toISOString(), legal_verified_by: u.user?.id ?? null })
                      .eq("id", c.id);
                    setBusy(false);
                    if (error) return toast.error(error.message);
                    toast.success(c.legal_verified_at ? "Marked as needing another check." : "Marked as checked by Legal.");
                    load();
                    onChanged?.();
                  }}
                >
                  {c.legal_verified_at ? "Undo Legal check" : "Mark checked by Legal"}
                </button>
              )}
              {canEdit && ["draft", "returned"].includes(c.approval_state) && (
                <button className={solidBtn} disabled={busy} onClick={() => rpc("submit_contract_for_approval", { _id: c.id }, "Sent to the Founders for approval.")}>
                  Send for approval
                </button>
              )}
              {isFounder && c.approval_state !== "approved" && (
                <button className={solidBtn} disabled={busy} onClick={() => rpc("approve_contract", { _id: c.id }, "Contract approved.")}>
                  Approve
                </button>
              )}
            </div>
            {isFounder && c.approval_state === "submitted" && (
              <div className="flex gap-2">
                <input className={field + " mt-0"} placeholder="What should Legal change?" value={note} onChange={(e) => setNote(e.target.value)} />
                <button
                  className={ghostBtn}
                  disabled={busy || !note.trim()}
                  onClick={() => rpc("return_contract", { _id: c.id, _note: note.trim() }, "Sent back to Legal.")}
                >
                  Send back
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
