import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { useResidentMe } from "@/hooks/useResidentMe";
import { useBriefs } from "@/hooks/useBriefs";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMessages } from "@/hooks/useMessages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectLightbox } from "@/components/ProjectLightbox";
import type { Project } from "@/hooks/useProjects";
import { toast } from "sonner";

type Tab = "overview" | "projects" | "briefs" | "announcements" | "profile";

const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";
const tabBtn = (active: boolean) =>
  `text-left mono text-xs uppercase tracking-[0.3em] py-2 transition-colors ${
    active ? "text-site-red" : "text-muted-foreground hover:text-foreground"
  }`;

export default function ResidentPortal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/residents/login", { replace: true }); return; }
      setEmail(data.session.user.email ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/residents/login", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const me = useResidentMe();
  const signOut = async () => { await supabase.auth.signOut(); navigate("/residents/login", { replace: true }); };

  if (!authChecked || me.isLoading) {
    return <Layout hideFooter><div className="min-h-screen pt-32 px-6 mono text-xs">Loading…</div></Layout>;
  }

  if (!me.data) {
    return (
      <Layout hideFooter>
        <section className="min-h-screen pt-32 px-6 md:px-10 max-w-2xl mx-auto">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Access pending</div>
          <h1 className="display text-fluid-hero leading-[0.9]">Not invited yet.</h1>
          <p className="mt-6 text-fluid-md text-muted-foreground">
            We don't have a residency for <span className="text-foreground">{email}</span>. Ask the office to invite this email, then refresh.
          </p>
          <p className="mt-3 mono text-xs text-muted-foreground">
            <a className="text-site-red" href="mailto:office@site99ug.com">office@site99ug.com</a>
          </p>
          <button onClick={signOut} className="mt-10 mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">
            Sign out →
          </button>
        </section>
      </Layout>
    );
  }

  const r = me.data;

  return (
    <Layout hideFooter>
      <section className="min-h-screen pt-28 pb-20 px-6 md:px-10 max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8 border-b border-border pb-6">
          <div>
            <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-2">Resident Portal</div>
            <h1 className="display text-fluid-lg leading-[0.9]">{r.name}</h1>
            <div className={lbl + " mt-2"}>{r.territory} · since {r.since} · {r.status}</div>
          </div>
          <button onClick={signOut} className="mono text-xs uppercase tracking-[0.3em] hover:text-site-red">Sign out →</button>
        </div>

        <div className="grid md:grid-cols-[180px_1fr] gap-10">
          <nav className="flex md:flex-col gap-4 md:gap-1 overflow-x-auto md:overflow-visible scrollbar-none">
            {(["overview","projects","briefs","announcements","profile"] as Tab[]).map((t) => (
              <button key={t} className={tabBtn(tab === t)} onClick={() => setTab(t)}>
                {t === "profile" ? "Profile · Messages" : t}
              </button>
            ))}
          </nav>

          <div>
            {tab === "overview" && <Overview r={r} />}
            {tab === "projects" && <ProjectsTab residentId={r.id} />}
            {tab === "briefs" && <BriefsTab residentId={r.id} />}
            {tab === "announcements" && <AnnouncementsTab />}
            {tab === "profile" && <ProfileTab r={r} qc={qc} />}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function Overview({ r }: { r: { id: string; name: string; status: string; since: string } }) {
  const briefs = useBriefs(r.id);
  const ann = useAnnouncements(true);
  const stats = [
    { k: "Status", v: r.status },
    { k: "Since", v: r.since },
    { k: "Briefs", v: String(briefs.data?.length ?? 0) },
    { k: "Announcements", v: String(ann.data?.length ?? 0) },
  ];
  return (
    <div>
      <p className="text-fluid-md text-muted-foreground mb-10">
        Welcome back, <span className="text-foreground">{r.name.split(" ")[0]}</span>. Everything you need is on the left.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.k} className="border border-border rounded-2xl p-5">
            <div className={lbl}>{s.k}</div>
            <div className="display text-2xl mt-2">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsTab({ residentId }: { residentId: string }) {
  const [open, setOpen] = useState<Project | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["resident-projects", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_projects")
        .select("project:projects(*)")
        .eq("resident_id", residentId);
      if (error) throw error;
      return (data || []).map((row: any) => row.project as Project).filter(Boolean);
    },
  });
  if (isLoading) return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  if (!data.length) return <div className="mono text-xs text-muted-foreground">No projects assigned yet.</div>;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="text-left group">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
              <img src={p.cover_url} alt={p.title}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-700" />
            </div>
            <div className="mt-3 flex justify-between gap-3">
              <div className="display text-lg truncate">{p.title}</div>
              <div className={lbl}>{p.year}</div>
            </div>
          </button>
        ))}
      </div>
      <ProjectLightbox project={open} onClose={() => setOpen(null)} />
    </>
  );
}

function BriefsTab({ residentId }: { residentId: string }) {
  const { data = [], isLoading } = useBriefs(residentId);
  if (isLoading) return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  if (!data.length) return <div className="mono text-xs text-muted-foreground">No briefs yet.</div>;
  return (
    <div className="grid gap-4">
      {data.map((b) => (
        <div key={b.id} className="border border-border rounded-2xl p-5">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="display text-2xl">{b.title}</h3>
            <div className={lbl + " whitespace-nowrap"}>{new Date(b.created_at).toLocaleDateString()}</div>
          </div>
          {b.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{b.body}</p>}
          {b.file_url && (
            <a href={b.file_url} target="_blank" rel="noreferrer"
              className="inline-block mt-3 mono text-xs uppercase tracking-[0.3em] text-site-red hover:underline">
              Open file →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function AnnouncementsTab() {
  const { data = [], isLoading } = useAnnouncements(true);
  if (isLoading) return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  if (!data.length) return <div className="mono text-xs text-muted-foreground">No announcements yet.</div>;
  return (
    <div className="grid gap-4">
      {data.map((a) => (
        <div key={a.id} className="border border-border rounded-2xl p-5">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="display text-2xl">{a.title}</h3>
            <div className={lbl + " whitespace-nowrap"}>{new Date(a.created_at).toLocaleDateString()}</div>
          </div>
          {a.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>}
        </div>
      ))}
    </div>
  );
}

function ProfileTab({ r, qc }: { r: any; qc: ReturnType<typeof useQueryClient> }) {
  const messages = useMessages(r.id);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      resident_id: r.id, sender_role: "resident", body: body.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages", r.id] });
  };

  const grouped = useMemo(() => messages.data ?? [], [messages.data]);

  return (
    <div className="grid gap-10">
      <section>
        <div className={lbl + " mb-3"}>Profile</div>
        <div className="border border-border rounded-2xl p-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div><div className={lbl}>Name</div><div className="mt-1">{r.name}</div></div>
          <div><div className={lbl}>Territory</div><div className="mt-1">{r.territory}</div></div>
          <div><div className={lbl}>Email</div><div className="mt-1">{r.email}</div></div>
          <div><div className={lbl}>Status</div><div className="mt-1">{r.status}</div></div>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-3">
          Need a change? Message the office below.
        </p>
      </section>

      <section>
        <div className={lbl + " mb-3"}>Messages with the office</div>
        <div className="border border-border rounded-2xl p-5 max-h-[420px] overflow-y-auto space-y-3 mb-3">
          {grouped.length === 0 && <div className="mono text-xs text-muted-foreground">No messages yet — say hi.</div>}
          {grouped.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "resident" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line ${
                m.sender_role === "resident" ? "bg-site-red text-site-white" : "bg-secondary"
              }`}>
                {m.body}
                <div className={`mono text-[10px] uppercase tracking-[0.2em] mt-1 opacity-70`}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-3">
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            className="flex-1 bg-transparent border border-border rounded-2xl p-3 text-sm focus:border-site-red outline-none resize-none" />
          <button type="submit" disabled={sending || !body.trim()}
            className="bg-site-red text-site-white px-6 py-3 rounded-full label text-xs disabled:opacity-50 self-end">
            Send →
          </button>
        </form>
      </section>
    </div>
  );
}
