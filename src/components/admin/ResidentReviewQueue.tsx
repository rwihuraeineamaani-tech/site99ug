import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useResidents } from "@/hooks/useResidents";
import { Button } from "@/components/ui/button";

type WebsiteProject = {
  id: string;
  title: string;
  client: string;
  updated_at: string;
  resident_projects: { resident_id: string }[] | null;
};

type ReviewGroup = {
  key: string;
  client: string;
  projects: WebsiteProject[];
  latestUpdate: string;
};

type CreateForm = { name: string; territory: string; since: string; email: string };

const internalNames = new Set(["in house", "in-house", "site 99", "site99", "site 99 ug", "site99 ug"]);
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export default function ResidentReviewQueue() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: residents = [] } = useResidents();
  const [linking, setLinking] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState("");
  const [form, setForm] = useState<CreateForm>({ name: "", territory: "", since: String(new Date().getFullYear()), email: "" });
  const [saving, setSaving] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["website-resident-review"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,client,updated_at,resident_projects(resident_id)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WebsiteProject[];
    },
  });

  const groups = useMemo(() => {
    const grouped = new Map<string, ReviewGroup>();
    projects.forEach((project) => {
      const key = normalise(project.client);
      if (!key || internalNames.has(key) || (project.resident_projects?.length ?? 0) > 0) return;
      const current = grouped.get(key);
      if (current) {
        current.projects.push(project);
        if (project.updated_at > current.latestUpdate) current.latestUpdate = project.updated_at;
      } else {
        grouped.set(key, { key, client: project.client.trim(), projects: [project], latestUpdate: project.updated_at });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));
  }, [projects]);

  const orderedResidents = (client: string) => [...residents].sort((a, b) => {
    const target = normalise(client);
    const aName = normalise(a.name);
    const bName = normalise(b.name);
    const score = (name: string) => name === target ? 0 : name.includes(target) || target.includes(name) ? 1 : 2;
    return score(aName) - score(bName) || a.name.localeCompare(b.name);
  });

  const reset = () => {
    setLinking(null);
    setCreating(null);
    setSelectedResident("");
    setForm({ name: "", territory: "", since: String(new Date().getFullYear()), email: "" });
  };

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["website-resident-review"] }),
      qc.invalidateQueries({ queryKey: ["projects"] }),
      qc.invalidateQueries({ queryKey: ["residents"] }),
      qc.invalidateQueries({ queryKey: ["residents-public"] }),
    ]);
  };

  const resolve = async (group: ReviewGroup, residentId?: string) => {
    if (residentId) {
      const resident = residents.find((item) => item.id === residentId);
      if (!resident || !confirm(`Link ${group.projects.length} project${group.projects.length === 1 ? "" : "s"} labelled “${group.client}” to ${resident.name}?`)) return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("resolve_website_resident", {
      _project_ids: group.projects.map((project) => project.id),
      _resident_id: residentId ?? null,
      _name: residentId ? null : form.name,
      _territory: residentId ? null : form.territory,
      _since: residentId ? null : form.since,
      _email: residentId ? null : form.email || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    reset();
    toast.success(residentId ? "Projects linked to the Resident" : "Resident created and projects linked");
    if (!residentId && data) navigate(`/app/residents/${data}`);
  };

  if (isLoading) return <div className="rounded-md border border-rule bg-paper-raised p-5 text-sm text-ink-soft">Checking website links…</div>;

  return (
    <section className="rounded-md border border-rule bg-paper-raised" aria-labelledby="resident-review-title">
      <div className="flex flex-col gap-3 border-b border-rule p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-signal">System Administrator</p>
          <h3 id="resident-review-title" className="mt-1 text-lg font-bold">Needs review</h3>
          <p className="mt-1 text-sm text-ink-soft">Website client names that are not connected to a Resident record.</p>
        </div>
        <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-md border border-rule bg-paper-sunken px-3 text-sm font-semibold">
          {groups.length ? <AlertTriangle className="h-4 w-4 text-signal" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
          {groups.length} to review
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-3 p-5 text-sm text-ink-soft"><CheckCircle2 className="h-5 w-5 text-success" /> Every external website client is linked.</div>
      ) : groups.map((group) => (
        <article key={group.key} className="border-b border-rule p-4 last:border-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h4 className="font-semibold">{group.client}</h4>
              <p className="mt-1 text-xs text-ink-faint">Last changed {new Date(group.latestUpdate).toLocaleDateString()}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.projects.map((project) => <span key={project.id} className="rounded-sm border border-rule bg-paper-sunken px-2 py-1 text-xs text-ink-soft">{project.title}</span>)}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => { setCreating(null); setLinking(group.key); setSelectedResident(""); }}><Link2 /> Link existing</Button>
              <Button size="sm" onClick={() => { setLinking(null); setCreating(group.key); setForm({ name: group.client, territory: "", since: String(new Date().getFullYear()), email: "" }); }}><Plus /> Create Resident</Button>
            </div>
          </div>

          {linking === group.key && (
            <div className="mt-4 grid gap-3 rounded-md border border-rule bg-paper-sunken p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div><label className="eyebrow text-ink-faint" htmlFor={`link-${group.key}`}>Choose the matching Resident</label><select id={`link-${group.key}`} className="field mt-2 min-h-11 text-base" value={selectedResident} onChange={(event) => setSelectedResident(event.target.value)}><option value="">Select a Resident…</option>{orderedResidents(group.client).map((resident) => <option key={resident.id} value={resident.id}>{resident.name}</option>)}</select></div>
              <div className="flex gap-2"><Button disabled={!selectedResident || saving} onClick={() => resolve(group, selectedResident)}>{saving ? "Linking…" : "Confirm link"}</Button><Button variant="ghost" size="icon" aria-label="Cancel linking" onClick={reset}><X /></Button></div>
            </div>
          )}

          {creating === group.key && (
            <form className="mt-4 grid gap-4 rounded-md border border-rule bg-paper-sunken p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void resolve(group); }}>
              <div><label className="eyebrow text-ink-faint" htmlFor={`name-${group.key}`}>Resident name *</label><input id={`name-${group.key}`} required className="field mt-2 min-h-11 text-base" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div><label className="eyebrow text-ink-faint" htmlFor={`area-${group.key}`}>Area / category *</label><input id={`area-${group.key}`} required className="field mt-2 min-h-11 text-base" placeholder="e.g. Kampala · Hospitality" value={form.territory} onChange={(event) => setForm({ ...form, territory: event.target.value })} /></div>
              <div><label className="eyebrow text-ink-faint" htmlFor={`year-${group.key}`}>Starting year *</label><input id={`year-${group.key}`} required inputMode="numeric" pattern="[0-9]{4}" className="field mt-2 min-h-11 text-base" value={form.since} onChange={(event) => setForm({ ...form, since: event.target.value })} /></div>
              <div><label className="eyebrow text-ink-faint" htmlFor={`email-${group.key}`}>Email</label><input id={`email-${group.key}`} type="email" className="field mt-2 min-h-11 text-base" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
              <p className="text-xs text-ink-soft sm:col-span-2">The new Resident stays hidden from the public website until its record is ready.</p>
              <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row"><Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create and link"}</Button><Button type="button" variant="ghost" onClick={reset}>Cancel</Button></div>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}