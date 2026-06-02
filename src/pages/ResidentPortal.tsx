import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PortalAurora } from "@/components/PortalAurora";
import { useResidentMe } from "@/hooks/useResidentMe";
import { useBriefs } from "@/hooks/useBriefs";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMessages } from "@/hooks/useMessages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectLightbox } from "@/components/ProjectLightbox";
import type { Project } from "@/hooks/useProjects";
import { toast } from "sonner";

type Tab = "overview" | "projects" | "briefs" | "announcements" | "profile";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "briefs", label: "Briefs" },
  { id: "announcements", label: "Announcements" },
  { id: "profile", label: "Profile · Messages" },
];

const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";

export default function ResidentPortal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/residents/login", { replace: true });
        return;
      }
      setEmail(data.session.user.email ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/residents/login", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const me = useResidentMe();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/residents/login", { replace: true });
  };

  if (!authChecked || me.isLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen pt-32 px-6 mono text-xs">Loading…</div>
      </Layout>
    );
  }

  if (!me.data) {
    return (
      <Layout hideFooter>
        <section className="relative min-h-screen pt-32 px-6 md:px-10 max-w-2xl mx-auto">
          <PortalAurora className="-z-10" />
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">
            Access pending
          </div>
          <h1 className="display text-fluid-hero leading-[0.9]">Not invited yet.</h1>
          <p className="mt-6 text-fluid-md text-muted-foreground">
            We don't have a residency for{" "}
            <span className="text-foreground">{email}</span>. Ask the office to invite this
            email, then refresh.
          </p>
          <p className="mt-3 mono text-xs text-muted-foreground">
            <a className="text-site-red" href="mailto:office@site99ug.com">
              office@site99ug.com
            </a>
          </p>
          <div className="mt-10 flex gap-6">
            <button
              onClick={() => me.refetch()}
              className="mono text-xs uppercase tracking-[0.3em] text-foreground hover:text-site-red"
            >
              Check again →
            </button>
            <button
              onClick={signOut}
              className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red"
            >
              Sign out →
            </button>
          </div>
        </section>
      </Layout>
    );
  }

  const r = me.data;

  return (
    <Layout hideFooter>
      {/* Hero band with toned-down aurora */}
      <section className="relative overflow-hidden border-b border-border">
        <PortalAurora />
        <div className="relative max-w-6xl mx-auto px-6 md:px-10 pt-28 pb-12 md:pt-32 md:pb-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">
                Resident Portal
              </div>
              <h1 className="display text-fluid-hero leading-[0.9]">{r.name}</h1>
              <div className={lbl + " mt-4"}>
                {r.territory} <span className="opacity-50 mx-1">·</span> since {r.since}{" "}
                <span className="opacity-50 mx-1">·</span> {r.status}
              </div>
            </div>
            <button
              onClick={signOut}
              className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red"
            >
              Sign out →
            </button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="grid md:grid-cols-[220px_1fr] gap-10 md:gap-16">
          {/* Numbered rail */}
          <nav className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto md:overflow-visible scrollbar-none -mx-6 px-6 md:mx-0 md:px-0">
            {TABS.map((t, i) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`group relative flex items-baseline gap-3 whitespace-nowrap py-2 md:py-3 md:pl-4 transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 hidden md:block h-5 w-[2px] transition-colors ${
                      active ? "bg-site-red" : "bg-transparent"
                    }`}
                  />
                  <span
                    className={`mono text-[10px] tracking-[0.3em] ${
                      active ? "text-site-red" : "text-muted-foreground"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mono text-xs uppercase tracking-[0.3em]">{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {tab === "overview" && <Overview r={r} onJump={setTab} />}
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

/* ---------- Overview ---------- */
function Overview({
  r,
  onJump,
}: {
  r: { id: string; name: string; status: string; since: string };
  onJump: (t: Tab) => void;
}) {
  const briefs = useBriefs(r.id);
  const ann = useAnnouncements(true);
  const latest = ann.data?.[0];

  const meta = [
    { k: "Status", v: r.status },
    { k: "Since", v: r.since },
    { k: "Briefs", v: String(briefs.data?.length ?? 0) },
    { k: "Announcements", v: String(ann.data?.length ?? 0) },
  ];

  return (
    <div className="space-y-12">
      <div>
        <div className={lbl + " mb-3"}>Dispatch</div>
        <p className="display text-fluid-lg leading-[1] max-w-2xl">
          Welcome back,{" "}
          <span className="text-site-red">{r.name.split(" ")[0]}.</span>
        </p>
        <p className="mt-4 text-fluid-md text-muted-foreground max-w-xl">
          Everything assigned to you lives in the rail on the left.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 border-t border-b border-border py-8">
        {meta.map((m) => (
          <div key={m.k}>
            <div className={lbl}>{m.k}</div>
            <div className="display text-3xl mt-2">{m.v}</div>
          </div>
        ))}
      </div>

      {latest && (
        <button
          onClick={() => onJump("announcements")}
          className="group block w-full text-left"
        >
          <div className={lbl + " mb-3"}>Latest announcement</div>
          <div className="flex items-baseline justify-between gap-6 border-t border-border pt-5">
            <h3 className="display text-2xl md:text-3xl group-hover:text-site-red transition-colors">
              {latest.title}
            </h3>
            <div className={lbl + " whitespace-nowrap"}>
              {new Date(latest.created_at).toLocaleDateString()}
            </div>
          </div>
          {latest.body && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2 max-w-2xl">
              {latest.body}
            </p>
          )}
          <span className="mt-3 inline-block mono text-[10px] uppercase tracking-[0.3em] text-site-red">
            Read all →
          </span>
        </button>
      )}
    </div>
  );
}

/* ---------- Projects ---------- */
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
  if (isLoading)
    return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  if (!data.length)
    return (
      <div>
        <div className={lbl + " mb-3"}>Projects</div>
        <p className="text-muted-foreground">No projects assigned yet.</p>
      </div>
    );
  return (
    <>
      <div className={lbl + " mb-6"}>Projects · {data.length}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="text-left group">
            <div className="aspect-[4/5] overflow-hidden bg-secondary">
              <img
                src={p.cover_url}
                alt={p.title}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition duration-700"
              />
            </div>
            <div className="mt-3 flex justify-between gap-3 border-b border-border pb-2 group-hover:border-site-red transition-colors">
              <div className="display text-lg truncate group-hover:text-site-red transition-colors">
                {p.title}
              </div>
              <div className={lbl}>{p.year}</div>
            </div>
          </button>
        ))}
      </div>
      <ProjectLightbox project={open} onClose={() => setOpen(null)} />
    </>
  );
}

/* ---------- Briefs ---------- */
function BriefsTab({ residentId }: { residentId: string }) {
  const { data = [], isLoading } = useBriefs(residentId);
  if (isLoading)
    return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  return (
    <div>
      <div className={lbl + " mb-6"}>Briefs · {data.length}</div>
      {!data.length ? (
        <p className="text-muted-foreground">No briefs yet.</p>
      ) : (
        <ul className="border-t border-border">
          {data.map((b) => (
            <li
              key={b.id}
              className="grid grid-cols-[88px_1fr] md:grid-cols-[140px_1fr] gap-4 md:gap-8 py-6 border-b border-border"
            >
              <div className={lbl + " pt-2"}>
                {new Date(b.created_at).toLocaleDateString()}
              </div>
              <div>
                <h3 className="display text-2xl">{b.title}</h3>
                {b.body && (
                  <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground max-w-2xl">
                    {b.body}
                  </p>
                )}
                {b.file_url && (
                  <a
                    href={b.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 mono text-xs uppercase tracking-[0.3em] text-site-red hover:underline"
                  >
                    Open file →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Announcements ---------- */
function AnnouncementsTab() {
  const { data = [], isLoading } = useAnnouncements(true);
  if (isLoading)
    return <div className="mono text-xs text-muted-foreground">Loading…</div>;
  return (
    <div>
      <div className={lbl + " mb-6"}>Announcements · {data.length}</div>
      {!data.length ? (
        <p className="text-muted-foreground">No announcements yet.</p>
      ) : (
        <ul className="border-t border-border">
          {data.map((a) => (
            <li
              key={a.id}
              className="grid grid-cols-[88px_1fr] md:grid-cols-[140px_1fr] gap-4 md:gap-8 py-6 border-b border-border"
            >
              <div className={lbl + " pt-2"}>
                {new Date(a.created_at).toLocaleDateString()}
              </div>
              <div>
                <h3 className="display text-2xl">{a.title}</h3>
                {a.body && (
                  <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground max-w-2xl">
                    {a.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Profile + Messages ---------- */
function ProfileTab({
  r,
  qc,
}: {
  r: any;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const messages = useMessages(r.id);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      resident_id: r.id,
      sender_role: "resident",
      body: body.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages", r.id] });
  };

  const grouped = useMemo(() => messages.data ?? [], [messages.data]);

  return (
    <div className="grid gap-14">
      <section>
        <div className={lbl + " mb-4"}>Profile</div>
        <div className="grid sm:grid-cols-2 gap-y-6 gap-x-10 border-t border-b border-border py-6 text-sm">
          <div>
            <div className={lbl}>Name</div>
            <div className="mt-1 display text-xl">{r.name}</div>
          </div>
          <div>
            <div className={lbl}>Territory</div>
            <div className="mt-1 display text-xl">{r.territory}</div>
          </div>
          <div>
            <div className={lbl}>Email</div>
            <div className="mt-1">{r.email ?? "—"}</div>
          </div>
          <div>
            <div className={lbl}>Status</div>
            <div className="mt-1">{r.status}</div>
          </div>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-3">
          Need a change? Message the office below.
        </p>
      </section>

      <section>
        <div className={lbl + " mb-4"}>Messages with the office</div>
        <div className="border-t border-border max-h-[420px] overflow-y-auto space-y-3 py-5 mb-4">
          {grouped.length === 0 && (
            <div className="mono text-xs text-muted-foreground">
              No messages yet — say hi.
            </div>
          )}
          {grouped.map((m) => {
            const isResident = m.sender_role === "resident";
            return (
              <div
                key={m.id}
                className={`flex ${isResident ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-md text-sm whitespace-pre-line ${
                    isResident
                      ? "bg-site-red text-site-white"
                      : "border border-border bg-transparent"
                  }`}
                >
                  {m.body}
                  <div className="mono text-[10px] uppercase tracking-[0.2em] mt-2 opacity-70">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={send} className="flex gap-3 border-t border-border pt-4">
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            className="flex-1 bg-transparent border border-border rounded-md p-3 text-sm focus:border-site-red outline-none resize-none"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-site-red text-site-white px-6 py-3 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 self-end"
          >
            Send →
          </button>
        </form>
      </section>
    </div>
  );
}
