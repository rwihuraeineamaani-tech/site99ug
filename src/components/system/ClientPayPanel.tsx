import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading } from "@/components/system";

type Member = { user_id: string; display_name: string | null; email: string; title: string | null };
type Row = { resident_id: string; resident_name: string; user_id: string | null };

/**
 * One Handler per client. Pay for handling a client comes from the KPI
 * system (base salary, allowances, bonuses) — no retainer splits here.
 */
export default function ClientPayPanel({ residentId, index = "02" }: { residentId?: string; index?: string } = {}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: pay }, { data: team }] = await Promise.all([
      supabase.rpc("client_pay_overview"),
      supabase.from("team_members").select("user_id, display_name, email, title").order("display_name"),
    ]);
    setRows((pay as unknown as Row[]) ?? []);
    setMembers((team as unknown as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; handler: string }>();
    rows
      .filter((r) => !residentId || r.resident_id === residentId)
      .forEach((r) => {
        const e = map.get(r.resident_id) ?? { id: r.resident_id, name: r.resident_name, handler: "" };
        if (r.user_id && !e.handler) e.handler = r.user_id;
        map.set(r.resident_id, e);
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, residentId]);

  const setHandler = async (clientId: string, userId: string) => {
    setBusy(clientId);
    const { error } = await supabase.rpc("set_client_handler" as never, { _resident_id: clientId, _user_id: userId || null } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(userId ? "Handler saved" : "Handler removed");
    load();
  };

  if (loading) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div>
      <SectionHeading index={index} title="Handler" hint="One Handler per client — they are also the contact person" />
      <p className="text-sm text-ink-soft mb-3">
        Pay for handling a client comes from the KPI system.{" "}
        <Link to="/app/kpi/desk" className="text-signal focus-ring">
          Open the KPI desk
        </Link>
      </p>
      <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
        {clients.map((c) => (
          <li key={c.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="font-medium min-w-40">{c.name}</span>
            <select
              className="field text-sm ml-auto max-w-xs"
              value={c.handler}
              disabled={busy === c.id}
              onChange={(e) => setHandler(c.id, e.target.value)}
            >
              <option value="">No Handler yet</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email}
                  {m.title ? ` — ${m.title}` : ""}
                </option>
              ))}
            </select>
          </li>
        ))}
        {clients.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No clients yet.</li>}
      </ul>
    </div>
  );
}
