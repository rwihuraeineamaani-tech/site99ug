import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/components/admin/AdminShell";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useResidents, type Resident } from "@/hooks/useResidents";
import { useBriefs } from "@/hooks/useBriefs";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMessages } from "@/hooks/useMessages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import TeamPanel from "@/components/admin/TeamPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Handshake, FileText, Megaphone, MessageSquare, Inbox, Users, CalendarDays, ExternalLink, Plus, Pencil, Trash2, Upload, X } from "lucide-react";


type ProjForm = {
  id?: string; title: string; client: string; year: string; tag: string;
  description: string; cover_url: string; gallery_urls: string[];
  external_url: string; display_order: number; resident_ids: string[];
  youtube_url: string; aspect_ratio: string;
};
const emptyProj: ProjForm = {
  title: "", client: "", year: "", tag: "", description: "",
  cover_url: "", gallery_urls: [], external_url: "", display_order: 0, resident_ids: [],
  youtube_url: "", aspect_ratio: "4:5",
};



type Tab = "projects" | "residents" | "briefs" | "announcements" | "messages" | "requests" | "team";

const lbl = "eyebrow text-ink-faint";
const input = "field mt-2 min-h-11 text-base";
const panel = "rounded-md border border-rule bg-paper-raised";

export default function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("projects");

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate("/login", { replace: true }); return; }
      setUserId(sess.session.user.id);
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", sess.session.user.id);
      const list = (roles ?? []).map((r) => r.role as string);
      setIsAdmin(list.includes("admin"));
      setCanEdit(list.includes("admin") || list.includes("site_editor"));
      setAuthChecked(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/login", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); };

  if (!authChecked) return <AdminShell title="Admin"><p className="mono text-xs text-muted-foreground">Loading…</p></AdminShell>;

  if (!canEdit) {
    return (
      <AdminShell title="Not yet authorized.">
        <div className="max-w-2xl">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Access pending</div>
          <p className="text-fluid-md text-muted-foreground">Share this user ID with whoever set up the site:</p>
          <code className="mt-6 block bg-secondary p-4 mono text-xs break-all">{userId}</code>
          <button onClick={signOut} className="ctl mt-8 mono text-xs uppercase tracking-[0.3em] text-muted-foreground focus-ring px-3 py-1.5">Sign out →</button>
        </div>
      </AdminShell>
    );
  }


  const tabs: Tab[] = ["projects","residents","briefs","announcements","messages","requests", ...(isAdmin ? ["team" as Tab] : [])];
  const label = (t: Tab) => (t === "requests" ? "Access Requests" : t);
  const activeTab: Tab = tab === "team" && !isAdmin ? "projects" : tab;

  return (
    <AdminShell
      title="Site 99 Manager"
      eyebrow="Website"
      active={activeTab}
      layout="sidebar"
      actions={<Button asChild variant="outline" size="sm"><a href="/" target="_blank" rel="noreferrer">View website <ExternalLink /></a></Button>}
      nav={[
        ...tabs.map((t) => ({
          key: t,
          label: label(t),
          icon: ({ projects: <FolderKanban />, residents: <Handshake />, briefs: <FileText />, announcements: <Megaphone />, messages: <MessageSquare />, requests: <Inbox />, team: <Users /> } as Record<Tab, React.ReactNode>)[t],
          onClick: () => setTab(t),
        })),
        { key: "events", label: "Events", icon: <CalendarDays />, to: "/app/events" },
      ]}
    >
      {activeTab === "projects" && <ProjectsAdmin userId={userId} qc={qc} />}
      {activeTab === "residents" && <ResidentsAdmin />}
      {activeTab === "briefs" && <BriefsAdmin userId={userId} qc={qc} />}
      {activeTab === "announcements" && <AnnouncementsAdmin qc={qc} />}
      {activeTab === "messages" && <MessagesAdmin />}
      {activeTab === "requests" && <AccessRequests />}
      {activeTab === "team" && isAdmin && <TeamPanel />}
    </AdminShell>
  );

}

/* ---------- Projects ---------- */
function ProjectsAdmin({ userId, qc }: { userId: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const { data: projects = [], refetch } = useProjects();
  const { data: residents = [] } = useResidents();
  const [form, setForm] = useState<ProjForm>(emptyProj);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const startNew = () => { setForm(emptyProj); setEditing(true); };

  const uploadFile = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("project-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
  };

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try { setForm({ ...form, cover_url: await uploadFile(f) }); toast.success("Cover uploaded"); }
    catch (err: any) { toast.error(err.message); } finally { setUploading(false); }
  };
  const handleGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try { const urls = await Promise.all(files.map(uploadFile));
      setForm({ ...form, gallery_urls: [...form.gallery_urls, ...urls] }); toast.success(`${urls.length} uploaded`); }
    catch (err: any) { toast.error(err.message); } finally { setUploading(false); }
  };
  const isVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cover_url && !form.youtube_url.trim()) return toast.error("Add a cover image/video or a YouTube URL");
    const payload = {
      title: form.title, client: form.client, year: form.year, tag: form.tag,
      description: form.description || null, cover_url: form.cover_url,
      gallery_urls: form.gallery_urls, external_url: form.external_url || null,
      display_order: form.display_order,
      youtube_url: form.youtube_url.trim() || null,
      aspect_ratio: form.aspect_ratio || "4:5",
    };
    let projectId = form.id;
    if (form.id) {
      const { error } = await supabase.from("projects").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      projectId = data.id;
    }
    // Replace assignments
    if (projectId) {
      await supabase.from("resident_projects").delete().eq("project_id", projectId);
      if (form.resident_ids.length) {
        await supabase.from("resident_projects").insert(
          form.resident_ids.map((rid) => ({ project_id: projectId!, resident_id: rid }))
        );
      }
    }
    toast.success(form.id ? "Updated" : "Created");
    setForm(emptyProj); setEditing(false);
    qc.invalidateQueries({ queryKey: ["projects"] }); refetch();
  };

  const edit = async (p: Project) => {
    const { data: links } = await supabase.from("resident_projects").select("resident_id").eq("project_id", p.id);
    setForm({
      id: p.id, title: p.title, client: p.client, year: p.year, tag: p.tag,
      description: p.description || "", cover_url: p.cover_url,
      gallery_urls: p.gallery_urls || [], external_url: p.external_url || "",
      display_order: p.display_order,
      resident_ids: (links || []).map((l) => l.resident_id),
      youtube_url: (p as any).youtube_url || "",
      aspect_ratio: (p as any).aspect_ratio || "4:5",
    });
    setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); refetch();
  };

  const toggleResident = (rid: string) =>
    setForm((f) => ({ ...f, resident_ids: f.resident_ids.includes(rid)
      ? f.resident_ids.filter((x) => x !== rid)
      : [...f.resident_ids, rid] }));

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow text-signal">Portfolio</p><h2 className="mt-1 text-2xl font-bold">Projects</h2><p className="mt-1 text-sm text-ink-soft">Choose what appears on the public work page.</p></div>
        {!editing && <Button onClick={startNew}><Plus /> Add project</Button>}
      </header>

      {editing && <form onSubmit={save} className={`${panel} grid gap-5 p-4 sm:p-6 md:grid-cols-2`}>
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-4 md:col-span-2">
          <div><p className="eyebrow text-signal">Project editor</p><h3 className="mt-1 text-xl font-bold">{form.id ? "Edit project" : "New project"}</h3></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close editor" title="Close editor" onClick={() => { setForm(emptyProj); setEditing(false); }}><X /></Button>
        </div>
        <div><label className={lbl}>Title *</label><input required className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className={lbl}>Client *</label>
          <select required className={input} value={form.resident_ids[0] ?? (form.client ? "__inhouse" : "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__inhouse") setForm({ ...form, client: "In house", resident_ids: [] });
              else { const r = residents.find((x) => x.id === v); setForm({ ...form, client: r?.name ?? "", resident_ids: v ? [v] : [] }); }
            }}>
            <option value="">Pick a Resident…</option>
            <option value="__inhouse">In house / Site 99</option>
            {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></div>
        <div><label className={lbl}>Year *</label><input required className={input} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
        <div><label className={lbl}>Tag *</label><input required className={input} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
        <div><label className={lbl}>External URL</label><input className={input} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} /></div>
        <div><label className={lbl}>Display order</label><input type="number" className={input} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
        <div className="md:col-span-2"><label className={lbl}>YouTube URL (auto-plays muted on cover)</label><input placeholder="https://youtu.be/…" className={input} value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} /></div>
        <div>
          <label className={lbl}>Cover aspect ratio</label>
          <select className={input} value={form.aspect_ratio} onChange={(e) => setForm({ ...form, aspect_ratio: e.target.value })}>
            <option value="1:1">1:1 — Square</option>
            <option value="4:5">4:5 — Portrait (default)</option>
            <option value="2:3">2:3 — Tall portrait</option>
            <option value="3:2">3:2 — Landscape</option>
            <option value="16:9">16:9 — Widescreen</option>
            <option value="9:16">9:16 — Vertical</option>
          </select>
        </div>
        <div className="md:col-span-2"><label className={lbl}>Description</label><textarea rows={4} className={input + " resize-none"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="md:col-span-2">
          <label className={lbl}>Cover photo or video {form.youtube_url ? "(optional — YouTube will be used)" : "(used when no YouTube URL)"}</label>
          <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-rule bg-paper-sunken px-4 text-sm font-semibold hover:border-signal"><Upload className="h-4 w-4" /> Choose cover<input type="file" accept="image/*,video/*" onChange={handleCover} className="sr-only" /></label>
            {form.cover_url && (
              isVideo(form.cover_url)
                ? <video src={form.cover_url} className="h-20 w-20 rounded-md bg-paper-sunken object-cover" muted />
                : <img src={form.cover_url} alt="Project cover" className="h-20 w-20 rounded-md object-cover" />
            )}
            {form.cover_url && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, cover_url: "" })}>Clear</Button>}
          </div>
          {form.youtube_url && form.cover_url && (
            <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-2">Both set — YouTube takes priority on the card. Clear it above to use the cover.</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>Gallery (images & videos)</label>
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-rule bg-paper-sunken px-4 text-sm font-semibold hover:border-signal"><Upload className="h-4 w-4" /> Add gallery files<input type="file" accept="image/*,video/*" multiple onChange={handleGallery} className="sr-only" /></label>
          {form.gallery_urls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.gallery_urls.map((u, i) => (
                <div key={i} className="relative">
                  {isVideo(u)
                    ? <video src={u} className="h-16 w-16 rounded-md bg-paper-sunken object-cover" muted />
                    : <img src={u} className="h-16 w-16 rounded-md object-cover" alt="Gallery item" />}
                  <button type="button" onClick={() => setForm({ ...form, gallery_urls: form.gallery_urls.filter((_, idx) => idx !== i) })}
                    className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-signal text-paper focus-ring" aria-label="Remove gallery item"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>Assign to residents</label>
          {residents.length === 0 ? (
            <div className="mt-2 mono text-xs text-muted-foreground">Add residents first to assign projects.</div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {residents.map((r) => {
                const on = form.resident_ids.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => toggleResident(r.id)}
                    className={`min-h-10 rounded-md border px-3 py-2 text-sm transition-colors focus-ring ${
                      on ? "border-signal bg-signal text-paper" : "border-rule bg-paper-sunken hover:border-signal"
                    }`}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-rule pt-4 sm:flex-row md:col-span-2">
          <Button type="submit" disabled={uploading} className="sm:min-w-40">
            {editing ? "Save changes" : "Create project"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setForm(emptyProj); setEditing(false); }}>Cancel</Button>
        </div>
      </form>}

      <div className="overflow-hidden rounded-md border border-rule bg-paper-raised">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3"><p className="eyebrow text-ink-faint">Published work</p><span className="text-xs text-ink-faint">{projects.length} project{projects.length === 1 ? "" : "s"}</span></div>
        {projects.map((p) => (
          <div key={p.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-rule p-3 last:border-0 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
            {p.cover_url ? <img src={p.cover_url} alt="" className="h-16 w-16 rounded-sm bg-paper-sunken object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-sm bg-paper-sunken"><FolderKanban className="h-5 w-5 text-ink-faint" /></div>}
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold">{p.title}</div>
              <div className="mt-1 truncate text-xs text-ink-soft">{p.tag} · {p.client} · {p.year} · position {p.display_order}</div>
            </div>
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
              <Button variant="ghost" size="icon-sm" onClick={() => edit(p)} title="Edit project" aria-label={`Edit ${p.title}`}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(p.id)} title="Delete project" aria-label={`Delete ${p.title}`}><Trash2 /></Button>
            </div>
          </div>
        ))}
        {projects.length === 0 && <div className="px-4 py-14 text-center text-sm text-ink-soft">No projects have been added yet.</div>}
      </div>
    </div>
  );
}

/* ---------- Residents (read-only — edited in the team system) ---------- */
function ResidentsAdmin() {
  const { data: residents = [] } = useResidents();
  return (
    <>
      <div className="border border-border p-6 rounded-2xl mb-8">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">One home for clients</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Residents (clients) are now added and edited in one place — the Residents page in the team system.
          Website details (show on site, area, since, order) and social accounts live on each Resident's page.
        </p>
        <a href="/app/residents" className="ctl ctl-solid inline-block mt-4 px-6 py-3 label text-xs focus-ring">Open Residents</a>
      </div>
      <div className="grid gap-3">
        {residents.map((r: any) => {
          const shown = r.visible !== false;
          return (
            <div key={r.id} className={`flex items-center gap-4 border border-border p-4 rounded-2xl ${shown ? "" : "opacity-60"}`}>
              <div className="flex-1 min-w-0">
                <div className="display text-2xl truncate">{r.name}</div>
                <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {r.territory} · since {r.since} · {shown ? "on the website" : "hidden"}
                </div>
              </div>
              <a href={`/app/residents/${r.id}`} className="ctl mono text-xs uppercase tracking-[0.3em] focus-ring px-3 py-1.5">Open in Residents</a>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Briefs ---------- */
function BriefsAdmin({ userId, qc }: { userId: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const { data: residents = [] } = useResidents();
  const { data: briefs = [], refetch } = useBriefs(null);
  const [form, setForm] = useState({ resident_id: "", title: "", body: "", file_url: "" });
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    const ext = file.name.split(".").pop();
    const folder = form.resident_id || "shared";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("resident-files").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data } = await supabase.storage.from("resident-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl || "";
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try { setForm({ ...form, file_url: await uploadFile(f) }); toast.success("Uploaded"); }
    catch (err: any) { toast.error(err.message); } finally { setUploading(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resident_id) return toast.error("Select a resident");
    const { error } = await supabase.from("briefs").insert({
      resident_id: form.resident_id, title: form.title,
      body: form.body || null, file_url: form.file_url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Brief posted");
    setForm({ resident_id: "", title: "", body: "", file_url: "" });
    qc.invalidateQueries({ queryKey: ["briefs"] }); refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete brief?")) return;
    const { error } = await supabase.from("briefs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  };

  return (
    <>
      <form onSubmit={save} className="grid gap-6 mb-12 border border-border p-6 rounded-2xl">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">New brief</div>
        <div>
          <label className={lbl}>Resident *</label>
          <select required className={input} value={form.resident_id}
            onChange={(e) => setForm({ ...form, resident_id: e.target.value })}>
            <option value="">— Select —</option>
            {residents.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Title *</label><input required className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className={lbl}>Body</label><textarea rows={4} className={input + " resize-none"} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div>
          <label className={lbl}>Attachment</label>
          <input type="file" onChange={onFile} className="mt-2 text-sm block" />
          {form.file_url && <a href={form.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block mono text-xs text-site-red">Preview file →</a>}
        </div>
        <button type="submit" disabled={uploading} className="ctl ctl-solid px-8 py-4 label text-xs disabled:opacity-50 justify-self-start focus-ring">
          Post brief
        </button>
      </form>

      <div className="grid gap-3">
        {briefs.map((b) => {
          const r = residents.find((x: any) => x.id === b.resident_id) as any;
          return (
            <div key={b.id} className="border border-border p-4 rounded-2xl">
              <div className="flex justify-between items-start gap-4 mb-1">
                <div className="display text-xl">{b.title}</div>
                <button onClick={() => remove(b.id)} className="ctl mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground focus-ring px-3 py-1.5">Delete</button>
              </div>
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                {r?.name ?? "—"} · {new Date(b.created_at).toLocaleString()}
              </div>
              {b.body && <p className="text-sm text-muted-foreground whitespace-pre-line">{b.body}</p>}
              {b.file_url && <a href={b.file_url} target="_blank" rel="noreferrer" className="inline-block mt-2 mono text-xs text-site-red">Open file →</a>}
            </div>
          );
        })}
        {briefs.length === 0 && <div className="mono text-xs text-muted-foreground">No briefs yet.</div>}
      </div>
    </>
  );
}

/* ---------- Announcements ---------- */
function AnnouncementsAdmin({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: items = [], refetch } = useAnnouncements(false);
  const [form, setForm] = useState({ title: "", body: "", published: true });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({
      title: form.title, body: form.body || null, published: form.published,
    });
    if (error) return toast.error(error.message);
    toast.success("Posted");
    setForm({ title: "", body: "", published: true });
    qc.invalidateQueries({ queryKey: ["announcements"] }); refetch();
  };
  const togglePub = async (id: string, published: boolean) => {
    await supabase.from("announcements").update({ published }).eq("id", id);
    refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    refetch();
  };

  return (
    <>
      <form onSubmit={save} className="grid gap-6 mb-12 border border-border p-6 rounded-2xl">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">New announcement</div>
        <div><label className={lbl}>Title *</label><input required className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className={lbl}>Body</label><textarea rows={4} className={input + " resize-none"} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <label className="flex items-center gap-3 mono text-xs uppercase tracking-[0.3em]">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Published
        </label>
        <button type="submit" className="ctl ctl-solid px-8 py-4 label text-xs justify-self-start focus-ring">Post</button>
      </form>

      <div className="grid gap-3">
        {items.map((a) => (
          <div key={a.id} className="border border-border p-4 rounded-2xl">
            <div className="flex justify-between items-start gap-4 mb-1">
              <div className="display text-xl">{a.title}</div>
              <div className="flex gap-3 items-center">
                <label className="mono text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
                  <input type="checkbox" checked={a.published} onChange={(e) => togglePub(a.id, e.target.checked)} />
                  pub
                </label>
                <button onClick={() => remove(a.id)} className="ctl mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground focus-ring px-3 py-1.5">Delete</button>
              </div>
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {new Date(a.created_at).toLocaleString()} {!a.published && <span className="text-site-red">· draft</span>}
            </div>
            {a.body && <p className="text-sm text-muted-foreground whitespace-pre-line">{a.body}</p>}
          </div>
        ))}
        {items.length === 0 && <div className="mono text-xs text-muted-foreground">No announcements yet.</div>}
      </div>
    </>
  );
}

/* ---------- Messages ---------- */
function MessagesAdmin() {
  const { data: residents = [] } = useResidents();
  const [pickedId, setPicked] = useState<string | null>(null);
  const picked = useMemo(() => residents.find((r: any) => r.id === pickedId), [residents, pickedId]);
  const { data: msgs = [], refetch } = useMessages(pickedId);
  const [body, setBody] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedId || !body.trim()) return;
    const { error } = await supabase.from("messages").insert({
      resident_id: pickedId, sender_role: "admin", body: body.trim(),
    });
    if (error) return toast.error(error.message);
    setBody(""); refetch();
  };

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <div className="border border-border rounded-2xl p-3 max-h-[60vh] overflow-y-auto">
        <div className={lbl + " px-2 mb-2"}>Residents</div>
        {residents.map((r: any) => (
          <button key={r.id} onClick={() => setPicked(r.id)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
              pickedId === r.id ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground"
            }`}>
            {r.name}
          </button>
        ))}
        {residents.length === 0 && <div className="mono text-xs text-muted-foreground p-2">No residents.</div>}
      </div>

      <div className="border border-border rounded-2xl p-5 min-h-[60vh] flex flex-col">
        {!picked && <div className="m-auto mono text-xs text-muted-foreground">Select a resident.</div>}
        {picked && (
          <>
            <div className="mb-4 pb-3 border-b border-border">
              <div className="display text-xl">{(picked as any).name}</div>
              <div className={lbl}>{(picked as any).email || "no email"}</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-3">
              {msgs.length === 0 && <div className="mono text-xs text-muted-foreground">No messages yet.</div>}
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line ${
                    m.sender_role === "admin" ? "bg-site-red text-site-white" : "bg-secondary"
                  }`}>
                    {m.body}
                    <div className="mono text-[10px] uppercase tracking-[0.2em] mt-1 opacity-70">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-3">
              <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Reply…"
                className="flex-1 bg-transparent border border-border rounded-2xl p-3 text-sm focus:border-site-red outline-none resize-none" />
              <button type="submit" disabled={!body.trim()}
                className="ctl ctl-solid px-6 py-3 label text-xs disabled:opacity-50 self-end focus-ring">
                Send →
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Access Requests ---------- */
function AccessRequests() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["access_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("access_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; name: string; brand: string; email: string; territory: string; brief: string; created_at: string }>;
    },
  });
  if (isLoading) return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  if (!requests.length) return <div className="mono text-xs text-muted-foreground">No access requests yet.</div>;
  return (
    <div className="grid gap-4">
      {requests.map((r) => (
        <div key={r.id} className="border border-border p-5 rounded-2xl">
          <div className="flex justify-between items-start gap-4 mb-3">
            <div>
              <div className="display text-2xl">{r.name} <span className="text-muted-foreground">— {r.brand}</span></div>
              <a href={`mailto:${r.email}`} className="mono text-xs text-site-red">{r.email}</a>
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground whitespace-nowrap">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <div className={lbl}>Territory</div>
          <div className="text-sm mb-3">{r.territory}</div>
          <div className={lbl}>Brief</div>
          <p className="text-sm whitespace-pre-line">{r.brief}</p>
        </div>
      ))}
    </div>
  );
}
