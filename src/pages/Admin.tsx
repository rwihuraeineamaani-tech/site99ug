import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useResidents, type Resident } from "@/hooks/useResidents";
import { useBriefs } from "@/hooks/useBriefs";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMessages } from "@/hooks/useMessages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

type ResForm = { id?: string; name: string; territory: string; since: string; status: string; display_order: number; email: string; visible: boolean };
const emptyRes: ResForm = { name: "", territory: "", since: "", status: "Active", display_order: 0, email: "", visible: true };

type Tab = "projects" | "residents" | "briefs" | "announcements" | "messages" | "requests";

const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";
const input = "mt-2 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2 text-lg";

export default function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("projects");

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate("/admin/login", { replace: true }); return; }
      setUserId(sess.session.user.id);
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", sess.session.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setAuthChecked(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/admin/login", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate("/admin/login", { replace: true }); };

  if (!authChecked) return <Layout hideFooter><div className="min-h-screen pt-32 px-6 mono text-xs">Loading…</div></Layout>;

  if (!isAdmin) {
    return (
      <Layout hideFooter>
        <section className="min-h-screen pt-32 px-6 md:px-10 max-w-2xl mx-auto">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Access pending</div>
          <h1 className="display text-fluid-hero leading-[0.85]">Not yet authorized.</h1>
          <p className="mt-6 text-fluid-md text-muted-foreground">Share this user ID with whoever set up the site:</p>
          <code className="mt-6 block bg-secondary p-4 mono text-xs break-all">{userId}</code>
          <button onClick={signOut} className="mt-8 mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Sign out →</button>
        </section>
      </Layout>
    );
  }

  const tabs: Tab[] = ["projects","residents","briefs","announcements","messages","requests"];

  return (
    <Layout hideFooter>
      <section className="min-h-screen pt-28 pb-20 px-6 md:px-10 max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b border-border pb-6">
          <div>
            <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">Admin Console</div>
            <h1 className="display text-fluid-xl">Site 99 Manager</h1>
          </div>
          <button onClick={signOut} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">Sign out →</button>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 mb-10 mono text-xs uppercase tracking-[0.3em]">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2 border-b-2 transition-colors ${tab===t?"border-site-red text-site-red":"border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "requests" ? "Access Requests" : t}
            </button>
          ))}
        </nav>

        {tab === "projects" && <ProjectsAdmin userId={userId} qc={qc} />}
        {tab === "residents" && <ResidentsAdmin qc={qc} />}
        {tab === "briefs" && <BriefsAdmin userId={userId} qc={qc} />}
        {tab === "announcements" && <AnnouncementsAdmin qc={qc} />}
        {tab === "messages" && <MessagesAdmin />}
        {tab === "requests" && <AccessRequests />}
      </section>
    </Layout>
  );
}

/* ---------- Projects ---------- */
function ProjectsAdmin({ userId, qc }: { userId: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const { data: projects = [], refetch } = useProjects();
  const { data: residents = [] } = useResidents();
  const [form, setForm] = useState<ProjForm>(emptyProj);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    if (!form.cover_url) return toast.error("Cover image is required");
    const payload = {
      title: form.title, client: form.client, year: form.year, tag: form.tag,
      description: form.description || null, cover_url: form.cover_url,
      gallery_urls: form.gallery_urls, external_url: form.external_url || null,
      display_order: form.display_order,
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
    <>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-6 mb-12 border border-border p-6 rounded-2xl">
        <div className="md:col-span-2 mono text-xs uppercase tracking-[0.3em] text-site-red">{editing ? "Edit project" : "New project"}</div>
        <div><label className={lbl}>Title *</label><input required className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className={lbl}>Client *</label><input required className={input} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
        <div><label className={lbl}>Year *</label><input required className={input} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
        <div><label className={lbl}>Tag *</label><input required className={input} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
        <div><label className={lbl}>External URL</label><input className={input} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} /></div>
        <div><label className={lbl}>Display order</label><input type="number" className={input} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
        <div className="md:col-span-2"><label className={lbl}>Description</label><textarea rows={3} className={input + " resize-none"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="md:col-span-2">
          <label className={lbl}>Cover image *</label>
          <div className="mt-2 flex items-center gap-4">
            <input type="file" accept="image/*" onChange={handleCover} className="text-sm" />
            {form.cover_url && <img src={form.cover_url} alt="cover" className="h-20 w-20 object-cover rounded-2xl" />}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>Gallery (images & videos)</label>
          <input type="file" accept="image/*,video/*" multiple onChange={handleGallery} className="mt-2 text-sm block" />
          {form.gallery_urls.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.gallery_urls.map((u, i) => (
                <div key={i} className="relative">
                  {isVideo(u)
                    ? <video src={u} className="h-16 w-16 object-cover rounded-2xl bg-black" muted />
                    : <img src={u} className="h-16 w-16 object-cover rounded-2xl" alt="" />}
                  <button type="button" onClick={() => setForm({ ...form, gallery_urls: form.gallery_urls.filter((_, idx) => idx !== i) })}
                    className="absolute -top-2 -right-2 bg-site-red text-site-white w-5 h-5 rounded-full text-xs">×</button>
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
                    className={`px-3 py-1.5 rounded-full mono text-xs uppercase tracking-[0.2em] border transition-colors ${
                      on ? "bg-site-red text-site-white border-site-red" : "border-border hover:border-site-red"
                    }`}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={uploading} className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs disabled:opacity-50">
            {editing ? "Save changes" : "Create project"}
          </button>
          {editing && <button type="button" onClick={() => { setForm(emptyProj); setEditing(false); }} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Cancel</button>}
        </div>
      </form>

      <div className="grid gap-3">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-4 border border-border p-3 rounded-2xl">
            <img src={p.cover_url} alt="" className="h-16 w-16 object-cover rounded-2xl bg-secondary" />
            <div className="flex-1 min-w-0">
              <div className="display text-xl truncate">{p.title}</div>
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{p.tag} · {p.client} · {p.year} · order {p.display_order}</div>
            </div>
            <button onClick={() => edit(p)} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">Edit</button>
            <button onClick={() => remove(p.id)} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Delete</button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Residents ---------- */
function ResidentsAdmin({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: residents = [], refetch } = useResidents();
  const [form, setForm] = useState<ResForm>(emptyRes);
  const [editing, setEditing] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name, territory: form.territory, since: form.since, status: form.status,
      display_order: form.display_order, email: form.email.trim().toLowerCase() || null,
      visible: form.visible,
    };
    const { error } = form.id
      ? await supabase.from("residents").update(payload).eq("id", form.id)
      : await supabase.from("residents").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Invited");
    setForm(emptyRes); setEditing(false); qc.invalidateQueries({ queryKey: ["residents"] }); refetch();
  };
  const edit = (r: any) => {
    setForm({ id: r.id, name: r.name, territory: r.territory, since: r.since, status: r.status,
      display_order: r.display_order, email: r.email || "", visible: r.visible !== false });
    setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleVisible = async (r: any) => {
    const { error } = await supabase.from("residents").update({ visible: !(r.visible !== false) }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.visible !== false ? "Hidden from site" : "Showing on site");
    qc.invalidateQueries({ queryKey: ["residents"] }); refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this resident? Their portal access will be revoked.")) return;
    const { error } = await supabase.from("residents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["residents"] }); refetch();
  };

  return (
    <>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-6 mb-12 border border-border p-6 rounded-2xl">
        <div className="md:col-span-2 mono text-xs uppercase tracking-[0.3em] text-site-red">{editing ? "Edit resident" : "Invite resident"}</div>
        <div><label className={lbl}>Name *</label><input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className={lbl}>Territory *</label><input required placeholder="Kampala · Fast Food" className={input} value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></div>
        <div className="md:col-span-2">
          <label className={lbl}>Email * (used to invite)</label>
          <input required type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Send them <span className="text-site-red">/residents/login</span> — they sign up with this email and access opens automatically.
          </p>
        </div>
        <div><label className={lbl}>Since *</label><input required className={input} value={form.since} onChange={(e) => setForm({ ...form, since: e.target.value })} /></div>
        <div><label className={lbl}>Status</label><input className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
        <div><label className={lbl}>Display order</label><input type="number" className={input} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
        <div className="md:col-span-2 flex items-center gap-3">
          <label className="inline-flex items-center gap-3 mono text-xs uppercase tracking-[0.3em]">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} className="w-4 h-4 accent-site-red" />
            Show on public site
          </label>
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs">{editing ? "Save changes" : "Invite resident"}</button>
          {editing && <button type="button" onClick={() => { setForm(emptyRes); setEditing(false); }} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Cancel</button>}
        </div>
      </form>

      <div className="grid gap-3">
        {residents.map((r: any) => {
          const shown = r.visible !== false;
          return (
          <div key={r.id} className={`flex items-center gap-4 border border-border p-4 rounded-2xl ${shown ? "" : "opacity-60"}`}>
            <div className="flex-1 min-w-0">
              <div className="display text-2xl truncate">{r.name}</div>
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {r.territory} · since {r.since} · {r.status}
                {r.email && <> · <span className="text-foreground/80">{r.email}</span></>}
                {r.user_id ? <> · <span className="text-site-red">claimed</span></> : <> · pending signup</>}
                {" · "}<span className={shown ? "text-site-red" : "text-muted-foreground"}>{shown ? "visible" : "hidden"}</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (!r.email) return toast.error("Add an email first");
                const portalUrl = `${window.location.origin}/residents/login`;
                const subject = `You're invited to the Site 99 Resident Portal`;
                const body =
`Hi ${r.name},

You've been invited to the Site 99 Resident Portal.

1. Go to: ${portalUrl}
2. Sign up using THIS exact email: ${r.email}
3. Once you log in, your portal opens automatically — you'll see your assigned projects, briefs, announcements, and a direct line to the office.

Welcome aboard.
— Site 99
office@site99ug.com`;
                const message = `Subject: ${subject}\n\n${body}`;
                navigator.clipboard.writeText(message).then(
                  () => toast.success("Invite copied — paste into your email"),
                  () => toast.error("Couldn't copy")
                );
                window.open(`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
              }}
              className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red"
              title="Copy invite & open mail app"
            >
              Copy invite
            </button>
            <button onClick={() => toggleVisible(r)} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">{shown ? "Hide" : "Show"}</button>
            <button onClick={() => edit(r)} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">Edit</button>
            <button onClick={() => remove(r.id)} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Delete</button>
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
        <button type="submit" disabled={uploading} className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs disabled:opacity-50 justify-self-start">
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
                <button onClick={() => remove(b.id)} className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Delete</button>
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
        <button type="submit" className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs justify-self-start">Post</button>
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
                <button onClick={() => remove(a.id)} className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Delete</button>
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
                className="bg-site-red text-site-white px-6 py-3 rounded-full label text-xs disabled:opacity-50 self-end">
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
