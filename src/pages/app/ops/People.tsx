import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { StatusChip, SearchInput, FilterBar } from "@/components/system";

type Member = { user_id: string; display_name: string | null; email: string; title: string | null };
type Role = { user_id: string; role: string };
type Crew = { user_id: string | null; content_id: string };
type Assignment = { user_id: string; kind: string };

export default function People() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [assign, setAssign] = useState<Assignment[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, r, c, a] = await Promise.all([
        supabase.from("team_members").select("user_id, display_name, email, title").order("display_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("content_crew").select("user_id, content_id"),
        supabase.from("client_assignments").select("user_id, kind"),
      ]);
      setMembers((m.data as Member[]) ?? []);
      setRoles((r.data as Role[]) ?? []);
      setCrew((c.data as Crew[]) ?? []);
      setAssign((a.data as Assignment[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => `${m.display_name ?? ""} ${m.email} ${m.title ?? ""}`.toLowerCase().includes(needle));
  }, [members, q]);

  const rolesOf = (id: string) => roles.filter((r) => r.user_id === id).map((r) => r.role);
  const jobsOf = (id: string) => crew.filter((c) => c.user_id === id).length;
  const clientsOf = (id: string) => assign.filter((a) => a.user_id === id);

  return (
    <SectionPage
      eyebrow="Management"
      title="People."
      lede="Who is on the team, what they can reach, and how much they are carrying."
      path="/app/ops/people"
    >
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search the team…" />
      </FilterBar>

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((m) => {
            const mine = clientsOf(m.user_id);
            return (
              <li key={m.user_id} className="surface card-lift rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{m.display_name || m.email}</div>
                    <div className="text-xs text-ink-soft">{m.title || "No title set"}</div>
                  </div>
                  <span className="display text-2xl num">{jobsOf(m.user_id)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rolesOf(m.user_id).map((r) => (
                    <StatusChip key={r} value={r.replace(/_/g, " ")} tone="violet" />
                  ))}
                </div>
                <div className="mt-3 text-xs text-ink-soft">
                  {mine.length
                    ? `On ${mine.length} client${mine.length > 1 ? "s" : ""} — ${mine.filter((x) => x.kind === "contact").length} as contact, ${mine.filter((x) => x.kind === "handler").length} as handler`
                    : "Not on any client yet"}
                  {" · "}
                  {jobsOf(m.user_id)} content job{jobsOf(m.user_id) === 1 ? "" : "s"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionPage>
  );
}
