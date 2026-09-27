import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, StatusChip } from "@/components/system";
import { PASSWORD_HINT, suggestPassword } from "@/lib/password";

type Res = { id: string; name: string; primary_email: string | null; status: string | null };
type Login = { id: string; resident_id: string; user_id: string | null; email: string; accepted_at: string | null };
type Step = { resident_id: string; status: string };

const btn = "ctl ctl-solid eyebrow px-3 py-2 focus-ring";
const field = "field text-sm";

/** Give clients their portal login, or reset it. One resident when residentId is set, else every client. */
export default function PortalAccessPanel({ residentId, index = "01", showOnboarding = false }: { residentId?: string; index?: string; showOnboarding?: boolean }) {
  const [clients, setClients] = useState<Res[]>([]);
  const [logins, setLogins] = useState<Login[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", display_name: "", password: "" });
  const [reset, setReset] = useState<{ login: Login; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("residents").select("id, name, primary_email, status, archived_at").order("name");
    if (residentId) q = q.eq("id", residentId);
    const [r, l, s] = await Promise.all([
      q,
      supabase.from("resident_users").select("id, resident_id, user_id, email, accepted_at"),
      showOnboarding ? supabase.from("resident_onboarding_steps").select("resident_id, status") : Promise.resolve({ data: [] }),
    ]);
    setClients(((r.data as (Res & { archived_at: string | null })[]) ?? []).filter((x) => !x.archived_at));
    setLogins((l.data as Login[]) ?? []);
    setSteps((s.data as Step[]) ?? []);
  };
  useEffect(() => { load(); }, [residentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    setBusy(false);
    const msg = (data as { error?: string } | null)?.error ?? error?.message;
    if (msg) { toast.error(msg); return false; }
    return true;
  };

  const create = async (c: Res) => {
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (await call({ action: "client_login_create", resident_id: c.id, ...form })) {
      toast.success(`${c.name} can now sign in to their portal. Share the password with them directly.`);
      setOpen(null); setForm({ email: "", display_name: "", password: "" }); load();
    }
  };

  const doReset = async () => {
    if (!reset) return;
    if (reset.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (await call({ action: "client_login_reset", resident_id: reset.login.resident_id, user_id: reset.login.user_id, password: reset.password })) {
      toast.success("Password reset. Share the new one with the client.");
      setReset(null);
    }
  };

  const withAccess = clients.filter((c) => logins.some((l) => l.resident_id === c.id)).length;

  return (
    <section>
      <SectionHeading index={index} title="Portal access" hint={residentId ? "the client's own login" : `${withAccess} of ${clients.length} clients can sign in`} />
      <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
        {clients.map((c) => {
          const mine = logins.filter((l) => l.resident_id === c.id);
          const cs = steps.filter((s) => s.resident_id === c.id);
          const done = cs.filter((s) => s.status === "complete" || s.status === "not_needed").length;
          return (
            <li key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                {residentId ? <span className="display text-base">{c.name}</span> : <Link to={`/app/residents/${c.id}`} className="display text-base hover:underline underline-offset-4">{c.name}</Link>}
                {c.status && <StatusChip value={c.status} />}
                {showOnboarding && <span className="text-[11px] text-ink-faint">{cs.length ? `onboarding ${done} of ${cs.length}` : "no onboarding steps"}</span>}
                <StatusChip value={mine.length ? "portal ready" : "no portal login"} tone={mine.length ? "teal" : "amber"} />
                <button className={`${btn} ml-auto`} onClick={() => { setOpen(open === c.id ? null : c.id); setForm({ email: c.primary_email ?? "", display_name: "", password: "" }); }}>
                  {mine.length ? "add another login" : "give portal access"}
                </button>
              </div>
              {mine.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {mine.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink-soft">{l.email}</span>
                      {reset?.login.id === l.id ? (
                        <>
                          <input className={`${field} w-48`} value={reset.password} placeholder="new password" onChange={(e) => setReset({ ...reset, password: e.target.value })} />
                          <button className={btn} onClick={() => setReset({ ...reset, password: suggestPassword() })}>suggest</button>
                          {reset.password && <button className={btn} onClick={() => { navigator.clipboard.writeText(reset.password); toast.success("Copied"); }}>copy</button>}
                          <button className={btn} disabled={busy} onClick={doReset}>save</button>
                          <button className="text-xs text-ink-faint" onClick={() => setReset(null)}>cancel</button>
                        </>
                      ) : (
                        l.user_id && <button className="text-xs underline underline-offset-4 text-ink-faint hover:text-ink" onClick={() => setReset({ login: l, password: "" })}>reset password</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {open === c.id && (
                <div className="mt-4 grid gap-3 md:grid-cols-4 items-end">
                  <label className="text-xs text-ink-faint">Email<input className={`${field} mt-1`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                  <label className="text-xs text-ink-faint">Name<input className={`${field} mt-1`} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
                  <label className="text-xs text-ink-faint">Temporary password
                    <input className={`${field} mt-1`} value={form.password} placeholder="min 8 characters" onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <span className="mt-1 flex gap-2">
                      <button type="button" className={btn} onClick={() => setForm({ ...form, password: suggestPassword() })}>suggest</button>
                      {form.password && <button type="button" className={btn} onClick={() => { navigator.clipboard.writeText(form.password); toast.success("Copied"); }}>copy</button>}
                    </span>
                  </label>
                  <button className={btn} disabled={busy} onClick={() => create(c)}>create login</button>
                  <p className="md:col-span-4 text-[11px] text-ink-faint">{PASSWORD_HINT} The client sees only their own work, never other clients or internal money.</p>
                </div>
              )}
            </li>
          );
        })}
        {clients.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No clients.</li>}
      </ul>
    </section>
  );
}
