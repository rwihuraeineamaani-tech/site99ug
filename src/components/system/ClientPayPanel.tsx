import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/system";

type Member = { user_id: string; display_name: string | null; email: string; title: string | null };
type PayRow = {
  resident_id: string;
  resident_name: string;
  retainer_ugx: number;
  user_id: string | null;
  kind: string | null;
  share_amount_ugx: number | null;
  share_percent: number | null;
  computed_ugx: number | null;
};

type Person = { user_id: string; kind: "contact" | "handler"; mode: "amount" | "percent"; value: string };
type Draft = { retainer: string; people: Person[] };

const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;
const field = "field text-sm";

export default function ClientPayPanel({ residentId, index = "02" }: { residentId?: string; index?: string } = {}) {
  const [rows, setRows] = useState<PayRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ retainer: "0", people: [] });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: pay }, { data: team }] = await Promise.all([
      supabase.rpc("client_pay_overview"),
      supabase.from("team_members").select("user_id, display_name, email, title").order("display_name"),
    ]);
    setRows((pay as unknown as PayRow[]) ?? []);
    setMembers((team as unknown as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; retainer: number; people: PayRow[] }>();
    rows
      .filter((r) => !residentId || r.resident_id === residentId)
      .forEach((r) => {
        const entry = map.get(r.resident_id) ?? {
          id: r.resident_id,
          name: r.resident_name,
          retainer: r.retainer_ugx ?? 0,
          people: [],
        };
        if (r.user_id) entry.people.push(r);
        map.set(r.resident_id, entry);
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, residentId]);


  const nameOf = (id: string) => {
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || "Unknown";
  };

  const startEdit = (c: (typeof clients)[number]) => {
    setOpen(c.id);
    setDraft({
      retainer: String(c.retainer ?? 0),
      people: c.people.map((p) => ({
        user_id: p.user_id as string,
        kind: (p.kind as "contact" | "handler") ?? "handler",
        mode: p.share_percent !== null ? "percent" : "amount",
        value: p.share_percent !== null ? String(p.share_percent) : String(p.share_amount_ugx ?? 0),
      })),
    });
  };

  const retainer = Number(draft.retainer.replace(/[^\d]/g, "")) || 0;
  const lineTotal = (p: Person) => {
    const v = Number(p.value.replace(/[^\d.]/g, "")) || 0;
    return p.mode === "percent" ? Math.round((retainer * v) / 100) : Math.round(v);
  };
  const shareTotal = draft.people.reduce((a, p) => a + lineTotal(p), 0);
  const balance = retainer - shareTotal;
  const contactCount = draft.people.filter((p) => p.kind === "contact").length;

  const setPerson = (i: number, patch: Partial<Person>) =>
    setDraft((d) => ({ ...d, people: d.people.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));

  const addPerson = () => {
    const free = members.find((m) => !draft.people.some((p) => p.user_id === m.user_id));
    if (!free) return toast.error("Everyone on the team is already on this client.");
    setDraft((d) => ({
      ...d,
      people: [...d.people, { user_id: free.user_id, kind: contactCount ? "handler" : "contact", mode: "amount", value: "0" }],
    }));
  };

  const save = async () => {
    if (contactCount !== 1) return toast.error("Pick exactly one contact person.");
    if (balance < 0) return toast.error("The shares add up to more than the retainer.");
    setBusy(true);
    const { error } = await supabase.rpc("set_client_pay", {
      _resident_id: open,
      _retainer_ugx: retainer,
      _people: draft.people.map((p) => ({
        user_id: p.user_id,
        kind: p.kind,
        share_amount_ugx: p.mode === "amount" ? Math.round(Number(p.value.replace(/[^\d.]/g, "")) || 0) : null,
        share_percent: p.mode === "percent" ? Number(p.value.replace(/[^\d.]/g, "")) || 0 : null,
      })),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Client team and retainer saved");
    setOpen(null);
    load();
  };

  if (loading) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div>
      <SectionHeading
        index={index}
        title={residentId ? "Money" : "Team on each client"}
        hint="One contact, any number of handlers"
      />

      <div className="space-y-4">
        {clients.map((c) => {
          const paid = c.people.reduce((a, p) => a + (p.computed_ugx ?? 0), 0);
          const editing = open === c.id;
          return (
            <div key={c.id} className="surface rounded-2xl overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3 flex-wrap border-b border-rule">
                <div className="display text-lg">{c.name}</div>
                <div className="num text-sm text-ink-soft">{ugx(c.retainer ?? 0)} / month</div>
                <Button
                  size="sm"
                  variant={editing ? "secondary" : "default"}
                  className="ml-auto"
                  onClick={() => (editing ? setOpen(null) : startEdit(c))}
                >
                  {editing ? "Close" : "Set team & pay"}
                </Button>
              </div>

              {!editing && (
                <div className="px-5 py-4 text-sm space-y-1">
                  {c.people.length === 0 && <p className="text-ink-soft">Nobody assigned yet.</p>}
                  {c.people.map((p) => (
                    <div key={p.user_id} className="flex gap-3">
                      <span className="min-w-40">{nameOf(p.user_id as string)}</span>
                      <span className="eyebrow text-ink-faint">{p.kind}</span>
                      <span className="num ml-auto">{ugx(p.computed_ugx ?? 0)}</span>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2 border-t border-rule mt-2">
                    <span className="font-semibold">Site 99 balance</span>
                    <span className="num ml-auto font-semibold">{ugx((c.retainer ?? 0) - paid)}</span>
                  </div>
                </div>
              )}

              {editing && (
                <div className="px-5 py-4 space-y-4">
                  <div className="max-w-xs">
                    <label className="eyebrow text-ink-faint">Planned monthly retainer (UGX)</label>
                    <input
                      className={`${field} mt-2`}
                      value={draft.retainer}
                      onChange={(e) => setDraft({ ...draft, retainer: e.target.value })}
                    />
                  </div>

                  <div className="space-y-3">
                    {draft.people.map((p, i) => (
                      <div key={i} className="grid gap-2 md:grid-cols-[1.4fr_auto_auto_1fr_auto] items-center">
                        <select
                          className={field}
                          value={p.user_id}
                          onChange={(e) => setPerson(i, { user_id: e.target.value })}
                        >
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.display_name || m.email}
                              {m.title ? ` — ${m.title}` : ""}
                            </option>
                          ))}
                        </select>
                        <select
                          className={field}
                          value={p.kind}
                          onChange={(e) => setPerson(i, { kind: e.target.value as Person["kind"] })}
                        >
                          <option value="contact">Contact person</option>
                          <option value="handler">Handler</option>
                        </select>
                        <select
                          className={field}
                          value={p.mode}
                          onChange={(e) => setPerson(i, { mode: e.target.value as Person["mode"] })}
                        >
                          <option value="amount">Amount (UGX)</option>
                          <option value="percent">% of retainer</option>
                        </select>
                        <input
                          className={field}
                          value={p.value}
                          onChange={(e) => setPerson(i, { value: e.target.value })}
                        />
                        <div className="flex items-center gap-3">
                          <span className="num text-xs text-ink-soft">{ugx(lineTotal(p))}</span>
                          <button
                            className="eyebrow text-ink-faint hover:text-signal focus-ring"
                            onClick={() =>
                              setDraft((d) => ({ ...d, people: d.people.filter((_, idx) => idx !== i) }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="secondary" onClick={addPerson}>
                      Add someone
                    </Button>
                  </div>

                  <div className="rule-t pt-3 text-sm flex flex-wrap gap-6">
                    <span>
                      Shares <span className="num font-semibold">{ugx(shareTotal)}</span>
                    </span>
                    <span className={balance < 0 ? "text-signal" : ""}>
                      Site 99 balance <span className="num font-semibold">{ugx(balance)}</span>
                    </span>
                    {contactCount !== 1 && (
                      <span className="text-signal">Pick exactly one contact person.</span>
                    )}
                  </div>

                  <Button disabled={busy || balance < 0 || contactCount !== 1} onClick={save}>
                    {busy ? "Saving…" : "Save team & pay"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
