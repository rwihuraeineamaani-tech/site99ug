import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { niceDate } from "@/lib/legal";

type Member = { user_id: string; display_name: string | null; email: string };
type Crew = { user_id: string | null; content_id: string; role: string };
type Item = { id: string; ref_no: number; title: string; stage: string; shoot_at: string | null };
type Day = { id: string; shoot_date: string | null; status: string; location: string | null };

const OPEN_STAGES = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover"];

export default function Workload() {
  const [members, setMembers] = useState<Member[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, c, i, d] = await Promise.all([
        supabase.from("team_members").select("user_id, display_name, email").order("display_name"),
        supabase.from("content_crew").select("user_id, content_id, role"),
        supabase.from("content_items").select("id, ref_no, title, stage, shoot_at").in("stage", OPEN_STAGES),
        supabase.from("shoot_days").select("id, shoot_date, status, location").order("shoot_date", { ascending: true }),
      ]);
      setMembers((m.data as Member[]) ?? []);
      setCrew((c.data as Crew[]) ?? []);
      setItems((i.data as Item[]) ?? []);
      setDays((d.data as Day[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const byPerson = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const c of crew) {
      if (!c.user_id) continue;
      const it = items.find((x) => x.id === c.content_id);
      if (!it) continue;
      map.set(c.user_id, [...(map.get(c.user_id) ?? []), it]);
    }
    return map;
  }, [crew, items]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = days.filter((d) => d.shoot_date && d.shoot_date >= today && d.status !== "wrapped");

  return (
    <SectionPage
      eyebrow="Management"
      title="Workload."
      lede="What each person is carrying right now, and the shoots still ahead."
      path="/app/ops/workload"
    >
      <SectionHeading index="01" title="Shoots ahead" hint={`${upcoming.length} planned`} />
      {!upcoming.length ? (
        <div className="surface rounded-xl p-8 text-sm text-ink-soft mb-10">Nothing on the calendar.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mb-10">
          {upcoming.map((d) => (
            <li key={d.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold w-36">{niceDate(d.shoot_date)}</span>
              <span className="text-xs text-ink-soft flex-1">{d.location || "No location yet"}</span>
              <StatusChip value={d.status} />
              <Link to="/app/shoots" className="text-xs text-signal font-semibold">
                Open →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionHeading index="02" title="Who is on what" hint="Open jobs only" />
      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {members.map((m) => {
            const mine = byPerson.get(m.user_id) ?? [];
            return (
              <li key={m.user_id} className="surface rounded-2xl p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{m.display_name || m.email}</span>
                  <span className="display text-xl num">{mine.length}</span>
                </div>
                {!mine.length ? (
                  <p className="mt-2 text-xs text-ink-soft">Free this week.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {mine.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-sm">
                        <StatusChip value={it.stage} />
                        <Link to={`/app/content?ref=${it.ref_no}`} className="truncate hover:text-signal">
                          {it.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionPage>
  );
}
