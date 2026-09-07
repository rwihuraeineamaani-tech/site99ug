import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip, DataTable, type Column } from "@/components/system";
import TeamPanel from "@/components/admin/TeamPanel";

type Client = { id: string; name: string; contact_person: string | null; status: string; category: string };
type ClientUser = { id: string; client_id: string; email: string; accepted_at: string | null };

const btn = "ctl ctl-solid eyebrow px-4 py-2.5 focus-ring";
const input = "field mt-2 text-sm";

export default function Team() {
  const [clients, setClients] = useState<Client[]>([]);
  const [links, setLinks] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", contact_person: "", contact_email: "" });
  const [invite, setInvite] = useState({ client_id: "", email: "", display_name: "", password: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("clients").select("id, name, contact_person, status, category").order("name"),
      supabase.from("client_users").select("id, client_id, email, accepted_at"),
    ]);
    setClients((c as Client[]) ?? []);
    setLinks((l as ClientUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addClient = async () => {
    if (!newClient.name.trim()) return toast.error("Client name required");
    setBusy(true);
    const { error } = await supabase.from("clients").insert({
      name: newClient.name.trim(),
      contact_person: newClient.contact_person.trim() || null,
      contact_email: newClient.contact_email.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Client added");
    setNewClient({ name: "", contact_person: "", contact_email: "" });
    load();
  };

  const inviteClient = async () => {
    if (!invite.client_id) return toast.error("Pick a client");
    if (invite.password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "create", ...invite, roles: ["client"] },
    });
    setBusy(false);
    const msg = (data as { error?: string } | null)?.error ?? error?.message;
    if (msg) return toast.error(msg);
    toast.success("Client login created — share the password with them directly.");
    setInvite({ client_id: "", email: "", display_name: "", password: "" });
    load();
  };

  const cols: Column<Client>[] = [
    { key: "name", header: "Client", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "contact", header: "Contact", hideOnMobile: true, cell: (r) => r.contact_person || "—" },
    { key: "status", header: "Status", cell: (r) => <StatusChip value={r.status} /> },
    {
      key: "logins",
      header: "Logins",
      align: "right",
      cell: (r) => {
        const mine = links.filter((l) => l.client_id === r.id);
        return <span className="num text-sm">{mine.length ? mine.map((m) => m.email).join(", ") : "—"}</span>;
      },
    },
  ];

  return (
    <AppShell>
      <Seo title="Team & access — Site 99" description="Accounts, roles and client logins." path="/app/team" noindex />
      <PageHeader
        eyebrow="Access"
        title="Team & access."
        lede="Create accounts for the studio, set what each role can reach, and invite clients into their own portal."
      />

      <SectionHeading index="01" title="Studio team" hint="Roles decide what each person sees" />
      <TeamPanel />

      <div className="mt-14">
        <SectionHeading index="02" title="Clients" hint={`${clients.length} on record`} />
        <div className="surface rounded-2xl p-5 mb-5 grid gap-4 md:grid-cols-4 items-end">
          <div>
            <label className="eyebrow text-ink-faint">Client name</label>
            <input
              className={input}
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-ink-faint">Contact person</label>
            <input
              className={input}
              value={newClient.contact_person}
              onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-ink-faint">Contact email</label>
            <input
              className={input}
              type="email"
              value={newClient.contact_email}
              onChange={(e) => setNewClient({ ...newClient, contact_email: e.target.value })}
            />
          </div>
          <button className={btn} disabled={busy} onClick={addClient}>
            Add client
          </button>
        </div>
        <DataTable rows={clients} columns={cols} rowKey={(r) => r.id} loading={loading} empty="No clients yet." />
      </div>

      <div className="mt-14">
        <SectionHeading index="03" title="Invite a client" hint="One login, one engagement" />
        <div className="surface rounded-2xl p-5 grid gap-4 md:grid-cols-5 items-end">
          <div>
            <label className="eyebrow text-ink-faint">Client</label>
            <select
              className={input}
              value={invite.client_id}
              onChange={(e) => setInvite({ ...invite, client_id: e.target.value })}
            >
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow text-ink-faint">Email</label>
            <input
              className={input}
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-ink-faint">Name</label>
            <input
              className={input}
              value={invite.display_name}
              onChange={(e) => setInvite({ ...invite, display_name: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-ink-faint">Temporary password</label>
            <input
              className={input}
              value={invite.password}
              onChange={(e) => setInvite({ ...invite, password: e.target.value })}
              placeholder="min 8 characters"
            />
          </div>
          <button className={btn} disabled={busy} onClick={inviteClient}>
            Create client login
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          A client login sees only its own engagement — never other clients, team pay or internal finances.
        </p>
      </div>
    </AppShell>
  );
}
