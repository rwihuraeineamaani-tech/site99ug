import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useResidents, type Resident } from "@/hooks/useResidents";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ProjForm = {
  id?: string; title: string; client: string; year: string; tag: string;
  description: string; cover_url: string; gallery_urls: string[];
  external_url: string; display_order: number;
};
const emptyProj: ProjForm = {
  title: "", client: "", year: "", tag: "", description: "",
  cover_url: "", gallery_urls: [], external_url: "", display_order: 0,
};

type ResForm = { id?: string; name: string; territory: string; since: string; status: string; display_order: number };
const emptyRes: ResForm = { name: "", territory: "", since: "", status: "Active", display_order: 0 };

type Tab = "projects" | "residents" | "requests";

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
          <p className="mt-6 text-fluid-md text-muted-foreground">
            Share this user ID with whoever set up the site:
          </p>
          <code className="mt-6 block bg-secondary p-4 mono text-xs break-all">{userId}</code>
          <button onClick={signOut} className="mt-8 mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Sign out →</button>
        </section>
      </Layout>
    );
  }

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

        <nav className="flex gap-6 mb-10 mono text-xs uppercase tracking-[0.3em]">
          {(["projects","residents","requests"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2 border-b-2 transition-colors ${tab===t?"border-site-red text-site-red":"border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "requests" ? "Access Requests" : t}
            </button>
          ))}
        </nav>

        {tab === "projects" && <ProjectsAdmin userId={userId} qc={qc} />}
        {tab === "residents" && <ResidentsAdmin qc={qc} />}
        {tab === "requests" && <AccessRequests />}
      </section>
    </Layout>
  );
}

/* ---------- Projects ---------- */
function ProjectsAdmin({ userId, qc }: { userId: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const { data: projects = [], refetch } = useProjects();
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
    const { error } = form.id
      ? await supabase.from("projects").update(payload).eq("id", form.id)
      : await supabase.from("projects").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Created");
    setForm(emptyProj); setEditing(false); qc.invalidateQueries({ queryKey: ["projects"] }); refetch();
  };
  const edit = (p: Project) => {
    setForm({ id: p.id, title: p.title, client: p.client, year: p.year, tag: p.tag,
      description: p.description || "", cover_url: p.cover_url,
      gallery_urls: p.gallery_urls || [], external_url: p.external_url || "", display_order: p.display_order });
    setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); refetch();
  };

  return (
    <>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-6 mb-12 border border-border p-6">
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
            {form.cover_url && <img src={form.cover_url} alt="cover" className="h-20 w-20 object-cover rounded-lg" />}
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
                    ? <video src={u} className="h-16 w-16 object-cover rounded-lg bg-black" muted />
                    : <img src={u} className="h-16 w-16 object-cover rounded-lg" alt="" />}
                  <button type="button" onClick={() => setForm({ ...form, gallery_urls: form.gallery_urls.filter((_, idx) => idx !== i) })}
                    className="absolute -top-2 -right-2 bg-site-red text-site-white w-5 h-5 rounded-full text-xs">×</button>
                </div>
              ))}
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
          <div key={p.id} className="flex items-center gap-4 border border-border p-3">
            <img src={p.cover_url} alt="" className="h-16 w-16 object-cover rounded-lg bg-secondary" />
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
    const payload = { name: form.name, territory: form.territory, since: form.since, status: form.status, display_order: form.display_order };
    const { error } = form.id
      ? await supabase.from("residents").update(payload).eq("id", form.id)
      : await supabase.from("residents").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Added");
    setForm(emptyRes); setEditing(false); qc.invalidateQueries({ queryKey: ["residents"] }); refetch();
  };
  const edit = (r: Resident) => {
    setForm({ id: r.id, name: r.name, territory: r.territory, since: r.since, status: r.status, display_order: r.display_order });
    setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this resident?")) return;
    const { error } = await supabase.from("residents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["residents"] }); refetch();
  };

  return (
    <>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-6 mb-12 border border-border p-6">
        <div className="md:col-span-2 mono text-xs uppercase tracking-[0.3em] text-site-red">{editing ? "Edit resident" : "New resident"}</div>
        <div><label className={lbl}>Name *</label><input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className={lbl}>Territory *</label><input required placeholder="Kampala · Fast Food" className={input} value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></div>
        <div><label className={lbl}>Since *</label><input required className={input} value={form.since} onChange={(e) => setForm({ ...form, since: e.target.value })} /></div>
        <div><label className={lbl}>Status</label><input className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
        <div><label className={lbl}>Display order</label><input type="number" className={input} value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs">{editing ? "Save changes" : "Add resident"}</button>
          {editing && <button type="button" onClick={() => { setForm(emptyRes); setEditing(false); }} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Cancel</button>}
        </div>
      </form>

      <div className="grid gap-3">
        {residents.map((r) => (
          <div key={r.id} className="flex items-center gap-4 border border-border p-4">
            <div className="flex-1 min-w-0">
              <div className="display text-2xl truncate">{r.name}</div>
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{r.territory} · since {r.since} · {r.status} · order {r.display_order}</div>
            </div>
            <button onClick={() => edit(r)} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">Edit</button>
            <button onClick={() => remove(r.id)} className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Delete</button>
          </div>
        ))}
      </div>
    </>
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
        <div key={r.id} className="border border-border p-5">
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
