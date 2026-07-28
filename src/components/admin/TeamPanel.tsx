import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ROLE_HINTS, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";

type Member = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: StaffRole[];
};

const ALL_ROLES: StaffRole[] = ["admin", "event_manager", "scanner", "viewer", "site_editor"];

const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";
const input = "mt-2 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2";
const btn =
  "mono text-[10px] uppercase tracking-[0.2em] border border-border rounded-md px-3 py-1.5 hover:border-site-red hover:text-site-red transition-colors";

function RoleChecks({ value, onChange }: { value: StaffRole[]; onChange: (r: StaffRole[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALL_ROLES.map((r) => (
        <label key={r} className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(r)}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
            className="mt-1 accent-current"
          />
          <span>
            <span className="mono text-[11px] uppercase tracking-[0.2em]">{ROLE_LABELS[r]}</span>
            <span className="block text-xs text-muted-foreground mt-1">{ROLE_HINTS[r]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function TeamPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ email: "", display_name: "", password: "", roles: [] as StaffRole[] });
  const [editing, setEditing] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<StaffRole[]>([]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    if (error) {
      const msg = (data as any)?.error || error.message || "Request failed";
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await call({ action: "list" });
      setMembers(res.members ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await call({ action: "create", ...form });
      toast.success("Team member created");
      setForm({ email: "", display_name: "", password: "", roles: [] });
      setShowNew(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveRoles = async (m: Member) => {
    setBusy(true);
    try {
      await call({ action: "set_roles", user_id: m.user_id, roles: editRoles });
      toast.success("Access updated");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (m: Member) => {
    const password = prompt(`New password for ${m.email} (min 8 characters):`);
    if (!password) return;
    try {
      await call({ action: "reset_password", user_id: m.user_id, password });
      toast.success("Password updated — share it with them directly.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.email}? Their account and access are deleted permanently.`)) return;
    try {
      await call({ action: "delete", user_id: m.user_id });
      toast.success("Member removed");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-xl">
          Create accounts for your team and grant only the access each person needs. You set the password and share it
          with them directly.
        </p>
        <button className={btn} onClick={() => setShowNew((s) => !s)}>
          {showNew ? "Cancel" : "New member"}
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-border p-5 space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <div className={lbl}>Email</div>
              <input
                className={input}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@site99ug.com"
              />
            </div>
            <div>
              <div className={lbl}>Name</div>
              <input
                className={input}
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <div className={lbl}>Password</div>
              <input
                className={input}
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min 8 characters"
              />
            </div>
          </div>
          <div>
            <div className={`${lbl} mb-3`}>Access levels</div>
            <RoleChecks value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
          </div>
          <button
            disabled={busy}
            onClick={create}
            className="mono text-[10px] uppercase tracking-[0.2em] bg-site-red text-site-white rounded-md px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.4fr_1.6fr_auto] gap-4 px-4 py-3 border-b border-border bg-secondary/40">
          <span className={lbl}>Member</span>
          <span className={lbl}>Access</span>
          <span className={lbl}>Actions</span>
        </div>
        {loading && <p className="p-4 mono text-xs text-muted-foreground">Loading…</p>}
        {!loading && !members.length && (
          <p className="p-4 mono text-xs text-muted-foreground">No team members yet.</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="border-b border-border last:border-0">
            <div className="grid md:grid-cols-[1.4fr_1.6fr_auto] gap-3 px-4 py-4 items-start">
              <div className="min-w-0">
                <div className="text-sm truncate">{m.display_name || m.email}</div>
                <div className="mono text-[11px] text-muted-foreground truncate">{m.email}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.roles.length ? (
                  m.roles.map((r) => (
                    <span
                      key={r}
                      className="mono text-[9px] uppercase tracking-[0.2em] rounded-full border border-border px-2 py-1"
                    >
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))
                ) : (
                  <span className="mono text-[10px] text-muted-foreground">No access</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={btn}
                  onClick={() => {
                    setEditing(editing === m.user_id ? null : m.user_id);
                    setEditRoles(m.roles);
                  }}
                >
                  {editing === m.user_id ? "Close" : "Edit access"}
                </button>
                <button className={btn} onClick={() => resetPassword(m)}>
                  Reset password
                </button>
                <button className={`${btn} hover:text-site-red`} onClick={() => remove(m)}>
                  Remove
                </button>
              </div>
            </div>
            {editing === m.user_id && (
              <div className="px-4 pb-5 space-y-4">
                <RoleChecks value={editRoles} onChange={setEditRoles} />
                <button
                  disabled={busy}
                  onClick={() => saveRoles(m)}
                  className="mono text-[10px] uppercase tracking-[0.2em] bg-site-red text-site-white rounded-md px-4 py-2 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save access"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
