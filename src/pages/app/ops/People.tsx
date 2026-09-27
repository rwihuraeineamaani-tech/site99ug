import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, Phone, LayoutGrid, List, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { SearchInput, FilterBar, SelectFilter } from "@/components/system";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMyRoles } from "@/hooks/useMyRoles";
import { openDirectChat } from "@/lib/chat";
import { loadKpiMonth, ugx, type PersonKpi } from "@/lib/kpiPay";
import { avatarUrls, completeness, statusLabel, type FileStatus, toCsv, type Row } from "@/lib/staffProfile";
import StaffFileForm from "@/components/people/StaffFileForm";

type Member = { user_id: string; display_name: string | null; email: string; title: string | null; phone: string | null; avatar_url: string | null };
type Note = { id: string; user_id: string; kind: string; body: string; author_id: string; created_at: string };
const t = (n: string) => supabase.from(n as never);

function ago(iso?: string | null) {
  if (!iso) return "Never active";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 3) return "Online now";
  if (m < 60) return `Active ${m} min ago`;
  if (m < 1440) return `Active ${Math.round(m / 60)} h ago`;
  return `Active ${Math.round(m / 1440)} d ago`;
}
const initials = (s: string) => s.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");

export default function People() {
  const { userId, has } = useMyRoles();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hrLevel = has("hr", "managing_director", "founder", "admin");
  const mgmt = has("managing_director", "founder", "admin");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [myDept, setMyDept] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [presence, setPresence] = useState<Map<string, string>>(new Map());
  const [kpi, setKpi] = useState<Map<string, PersonKpi>>(new Map());
  const [att, setAtt] = useState<Map<string, number | null>>(new Map());
  const [work, setWork] = useState<Map<string, { open: number; late: number }>>(new Map());
  const [clients, setClients] = useState<Map<string, number>>(new Map());
  const [fileStatus, setFileStatus] = useState<Map<string, FileStatus>>(new Map());
  const [crew, setCrew] = useState<Map<string, number>>(new Map());
  const [dept, setDept] = useState<Map<string, string>>(new Map());
  const [emp, setEmp] = useState<Map<string, Row>>(new Map());
  const [files, setFiles] = useState<Map<string, number>>(new Map());
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState("note");
  const person = params.get("person");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const ok = await supabase.rpc("can_view_people" as never, { _u: userId } as never);
      setAllowed(Boolean(ok.data));
      if (!ok.data) { setLoading(false); return; }
      const month = new Date().toISOString().slice(0, 7);
      const [m, pr, pay, tasks, asg, cr, att, em, sp, sv, sd, kp] = await Promise.all([
        supabase.from("team_members").select("*").order("display_name"),
        supabase.from("user_presence").select("user_id,last_seen_at"),
        t("staff_pay").select("user_id,department,is_head"),
        supabase.from("leadership_tasks").select("id,status,due_at"),
        supabase.from("client_assignments").select("user_id"),
        supabase.from("content_crew").select("user_id"),
        t("attendance_records").select("user_id,status,day").gte("day", `${month}-01`),
        t("staff_employment").select("*"),
        hrLevel ? t("staff_profiles").select("*") : Promise.resolve({ data: [] }),
        hrLevel ? t("staff_private").select("*") : Promise.resolve({ data: [] }),
        hrLevel ? t("staff_documents").select("user_id,kind") : Promise.resolve({ data: [] }),
        loadKpiMonth(`${month}-01`).catch(() => null),
      ]);
      const mem = ((m.data as unknown as Member[]) ?? []).filter((x) => x.user_id);
      setMembers(mem);
      setPresence(new Map(((pr.data as { user_id: string; last_seen_at: string }[]) ?? []).map((x) => [x.user_id, x.last_seen_at])));
      const pays = (pay.data as unknown as { user_id: string; department: string | null; is_head: boolean }[]) ?? [];
      const emps = (em.data as unknown as Row[]) ?? [];
      const dmap = new Map<string, string>();
      pays.forEach((p) => p.department && dmap.set(p.user_id, p.department));
      emps.forEach((e) => e.department && dmap.set(e.user_id as string, e.department as string));
      setDept(dmap);
      setMyDept(!has("hr", "managing_director", "founder", "admin", "operations_manager") ? dmap.get(userId) ?? "__none" : null);
      setEmp(new Map(emps.map((e) => [e.user_id as string, e])));
      const asn = await supabase.from("leadership_task_assignees").select("task_id,user_id");
      const tmap = new Map(((tasks.data as { id: string; status: string; due_at: string | null }[]) ?? []).map((x) => [x.id, x]));
      const w = new Map<string, { open: number; late: number }>();
      const now = new Date().toISOString();
      ((asn.data as { task_id: string; user_id: string }[]) ?? []).forEach((a) => {
        const tk = tmap.get(a.task_id);
        if (!tk || ["accepted", "cancelled"].includes(tk.status)) return;
        const c = w.get(a.user_id) ?? { open: 0, late: 0 };
        c.open++;
        if (tk.due_at && tk.due_at < now) c.late++;
        w.set(a.user_id, c);
      });
      setWork(w);
      const count = (rows: { user_id: string | null }[]) => rows.reduce((mp, r) => (r.user_id ? mp.set(r.user_id, (mp.get(r.user_id) ?? 0) + 1) : mp), new Map<string, number>());
      setClients(count((asg.data as { user_id: string }[]) ?? []));
      setCrew(count((cr.data as { user_id: string | null }[]) ?? []));
      const recs = (att.data as unknown as { user_id: string; status: string }[]) ?? [];
      const am = new Map<string, number | null>();
      mem.forEach((x) => {
        const mine = recs.filter((r) => r.user_id === x.user_id && r.status !== "excused");
        am.set(x.user_id, mine.length ? Math.round((mine.filter((r) => r.status === "on_time").length / mine.length) * 100) : null);
      });
      setAtt(am);
      if (kp) setKpi(new Map(kp.people.map((p) => [p.member.user_id, p])));
      if (hrLevel) {
        const sps = (sp.data as unknown as Row[]) ?? [], svs = (sv.data as unknown as Row[]) ?? [], sds = (sd.data as unknown as { user_id: string; kind: string }[]) ?? [];
        const cs = mem.map((x) => [x.user_id, completeness(sps.find((r) => r.user_id === x.user_id) ?? null, svs.find((r) => r.user_id === x.user_id) ?? null, sds.filter((d) => d.user_id === x.user_id), true, emps.find((e) => e.user_id === x.user_id) ?? {})] as const);
        setFiles(new Map(cs.map(([k, c]) => [k, c.pct])));
        setFileStatus(new Map(cs.map(([k, c]) => [k, c.status])));
        const n = await t("staff_notes").select("*").order("created_at", { ascending: false });
        setNotes((n.data as unknown as Note[]) ?? []);
      }
      setAvatars(await avatarUrls(mem.map((x) => x.avatar_url ?? "")));
      setLoading(false);
    })();
  }, [userId, hrLevel]);

  const name = (m: Member) => m.display_name || m.email;
  const soon = (d?: unknown) => typeof d === "string" && d >= new Date().toISOString().slice(0, 10) && d <= new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const depts = useMemo(() => [...new Set(dept.values())].sort(), [dept]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter((m) => {
      if (myDept && m.user_id !== userId && dept.get(m.user_id) !== myDept) return false;
      if (needle && !`${name(m)} ${m.email} ${m.title ?? ""}`.toLowerCase().includes(needle)) return false;
      if (deptFilter !== "all" && dept.get(m.user_id) !== deptFilter) return false;
      const last = presence.get(m.user_id);
      if (filter === "online" && !(last && Date.now() - new Date(last).getTime() < 180000)) return false;
      if (filter === "late" && !(work.get(m.user_id)?.late)) return false;
      if (filter === "lowkpi" && !((kpi.get(m.user_id)?.score ?? 100) < 50)) return false;
      if (filter === "ending" && !(soon(emp.get(m.user_id)?.contract_end) || soon(emp.get(m.user_id)?.probation_end))) return false;
      if (filter === "incomplete" && fileStatus.get(m.user_id) === "good") return false;
      return true;
    });
  }, [members, q, filter, deptFilter, presence, work, kpi, emp, files, myDept, dept, userId]);

  const chat = async (uid: string) => {
    try { navigate(`/app/chat/${await openDirectChat(uid)}`); } catch (e) { toast.error((e as Error).message); }
  };
  const addNote = async () => {
    if (!person || !noteText.trim()) return;
    const { data, error } = await t("staff_notes").insert({ user_id: person, kind: noteKind, body: noteText.trim() } as never).select().single();
    if (error) return toast.error(error.message);
    setNotes((n) => [data as unknown as Note, ...n]);
    setNoteText("");
  };
  const exportRegister = async () => {
    const [sp, sv] = await Promise.all([t("staff_profiles").select("*"), t("staff_private").select("*")]);
    const P = new Map(((sp.data as unknown as Row[]) ?? []).map((r) => [r.user_id as string, r]));
    const V = new Map(((sv.data as unknown as Row[]) ?? []).map((r) => [r.user_id as string, r]));
    const rows = [["Name", "Legal name", "Title", "Department", "Nationality", "Date of birth", "Gender", "Phone", "District", "NIN", "Passport", "Work permit", "Permit expiry", "NSSF", "TIN", "Start date", "Contract type", "Contract end", "Bank", "Account", "Mobile money", "File %"],
      ...members.map((m) => { const p = P.get(m.user_id) ?? {}, v = V.get(m.user_id) ?? {}, e = emp.get(m.user_id) ?? {};
        return [name(m), p.legal_name, m.title, dept.get(m.user_id), p.nationality, p.date_of_birth, p.gender, m.phone, p.district, v.nin, v.passport_no, v.permit_class, v.permit_expiry, v.nssf_no, v.tin, e.start_date, e.contract_type, e.contract_end, v.bank_name, v.account_no, v.momo_number, files.get(m.user_id)] as (string | number | null | undefined)[]; })];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    a.download = "staff-register.csv";
    a.click();
  };

  if (allowed === false) return <SectionPage eyebrow="People" title="People." lede="Only HR, the Ops Manager, the MD, Founders and heads of department can open this page." path="/app/ops/people"><div /></SectionPage>;

  const Avatar = ({ m, size = 44 }: { m: Member; size?: number }) => {
    const src = m.avatar_url ? avatars.get(m.avatar_url) : null;
    const online = presence.get(m.user_id) && Date.now() - new Date(presence.get(m.user_id)!).getTime() < 180000;
    return (
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {src ? <img src={src} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="grid h-full w-full place-items-center rounded-full bg-muted text-sm font-semibold">{initials(name(m))}</span>}
        {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-signal" />}
      </span>
    );
  };
  const Actions = ({ m }: { m: Member }) => (
    <span className="flex gap-1.5">
      {m.user_id !== userId && <button onClick={(e) => { e.stopPropagation(); chat(m.user_id); }} className="press rounded-full border border-rule p-2" aria-label={`Chat with ${name(m)}`}><MessageCircle className="h-4 w-4" /></button>}
      {m.phone && <a onClick={(e) => e.stopPropagation()} href={`tel:${m.phone}`} className="press rounded-full border border-rule p-2" aria-label="Call"><Phone className="h-4 w-4" /></a>}
      {m.phone && <a onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" href={`https://wa.me/${m.phone.replace(/\D/g, "").replace(/^0/, "256")}`} className="press rounded-full border border-rule px-2.5 py-1.5 text-xs">WhatsApp</a>}
    </span>
  );
  const open = (uid: string) => setParams({ person: uid }, { replace: true });
  const sel = members.find((m) => m.user_id === person);
  const selKpi = person ? kpi.get(person) : undefined;

  return (
    <SectionPage eyebrow="Management" title="People." lede="Who's online, what they're carrying, how they're scoring — and, for HR, their full staff file." path="/app/ops/people"
      actions={hrLevel ? <button onClick={exportRegister} className="press flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-sm"><Download className="h-4 w-4" /> Staff register</button> : undefined}>
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search the team…" />
        <SelectFilter label="Show" value={filter} onChange={setFilter} options={[
          { value: "all", label: "Everyone" }, { value: "online", label: "Online now" }, { value: "late", label: "Has late work" },
          { value: "lowkpi", label: "KPI under 50" }, { value: "ending", label: "Contract/probation ending" },
          ...(hrLevel ? [{ value: "incomplete", label: "Incomplete file" }] : []),
        ]} />
        {!myDept && depts.length > 0 && <SelectFilter label="Department" value={deptFilter} onChange={setDeptFilter} options={[{ value: "all", label: "All" }, ...depts.map((d) => ({ value: d, label: d }))]} />}
        <span className="ml-auto flex gap-1">
          <button onClick={() => setView("cards")} aria-label="Cards" className={`rounded-full border p-2 ${view === "cards" ? "border-signal text-signal" : "border-rule"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} aria-label="List" className={`rounded-full border p-2 ${view === "list" ? "border-signal text-signal" : "border-rule"}`}><List className="h-4 w-4" /></button>
        </span>
      </FilterBar>

      {loading ? <div className="surface h-40 animate-pulse rounded-xl" /> : view === "cards" ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => {
            const k = kpi.get(m.user_id), w = work.get(m.user_id), a = att.get(m.user_id), e = emp.get(m.user_id);
            return (
              <li key={m.user_id} onClick={() => open(m.user_id)} className="surface card-lift cursor-pointer rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Avatar m={m} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{name(m)}</div>
                    <div className="truncate text-xs text-ink-soft">{m.title || "No title set"}{dept.get(m.user_id) ? ` · ${dept.get(m.user_id)}` : ""}</div>
                    <div className="text-[11px] text-ink-faint">{ago(presence.get(m.user_id))}</div>
                  </div>
                  <Actions m={m} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div><div className="display num text-xl">{k ? k.score : "—"}</div><div className="text-[10px] text-ink-soft">KPI</div></div>
                  <div><div className="display num text-xl">{a ?? "—"}{a !== null && a !== undefined ? "%" : ""}</div><div className="text-[10px] text-ink-soft">On time</div></div>
                  <div><div className="display num text-xl">{w?.open ?? 0}</div><div className="text-[10px] text-ink-soft">Open tasks</div></div>
                  <div><div className={`display num text-xl ${w?.late ? "text-signal" : ""}`}>{w?.late ?? 0}</div><div className="text-[10px] text-ink-soft">Late</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                  <span>{clients.get(m.user_id) ?? 0} clients</span><span>{crew.get(m.user_id) ?? 0} crew slots</span>
                  {hrLevel && <span className={fileStatus.get(m.user_id) === "incomplete" ? "text-destructive" : fileStatus.get(m.user_id) === "partly" ? "text-signal" : ""}>File: {statusLabel(fileStatus.get(m.user_id) ?? "incomplete")} ({files.get(m.user_id) ?? 0}%)</span>}
                  {(soon(e?.contract_end) || soon(e?.probation_end)) && <span className="text-signal">{soon(e?.contract_end) ? `Contract ends ${e?.contract_end}` : `Probation ends ${e?.probation_end}`}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="surface overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-soft"><tr><th className="p-3">Person</th><th>Last active</th><th>KPI</th><th>On time</th><th>Open / late</th><th>Clients</th>{hrLevel && <th>File</th>}<th /></tr></thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.user_id} onClick={() => open(m.user_id)} className="cursor-pointer border-t border-rule hover:bg-muted/40">
                  <td className="p-3"><span className="flex items-center gap-2"><Avatar m={m} size={28} /><span><span className="font-medium">{name(m)}</span><span className="block text-xs text-ink-soft">{m.title}</span></span></span></td>
                  <td className="text-xs">{ago(presence.get(m.user_id))}</td>
                  <td>{kpi.get(m.user_id)?.score ?? "—"}</td>
                  <td>{att.get(m.user_id) ?? "—"}</td>
                  <td>{work.get(m.user_id)?.open ?? 0} / {work.get(m.user_id)?.late ?? 0}</td>
                  <td>{clients.get(m.user_id) ?? 0}</td>
                  {hrLevel && <td>{statusLabel(fileStatus.get(m.user_id) ?? "incomplete")} · {files.get(m.user_id) ?? 0}%</td>}
                  <td className="pr-3"><Actions m={m} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!sel} onOpenChange={(o) => !o && setParams({}, { replace: true })}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3"><Avatar m={sel} size={52} /><span><span className="block">{name(sel)}</span><span className="block text-xs font-normal text-ink-soft">{sel.title} · {ago(presence.get(sel.user_id))}</span></span></SheetTitle>
              </SheetHeader>
              <div className="mt-3"><Actions m={sel} /></div>

              <section className="surface mt-5 rounded-xl p-4">
                <h3 className="display text-base">This month</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>KPI <b>{selKpi?.score ?? "—"}</b></div><div>On time <b>{att.get(sel.user_id) ?? "—"}%</b></div>
                  <div>Open tasks <b>{work.get(sel.user_id)?.open ?? 0}</b></div><div>Late <b>{work.get(sel.user_id)?.late ?? 0}</b></div>
                </div>
                {mgmt && selKpi && (
                  <>
                    <ul className="mt-3 space-y-1 text-xs">
                      {selKpi.parts.filter((p) => p.weight > 0).map((p) => <li key={p.key} className="flex justify-between"><span>{p.label}</span><span>{p.value === null ? "no data" : `${Math.round(p.value * 100)}%`} · weight {p.weight}</span></li>)}
                    </ul>
                    <div className="mt-3 border-t border-rule pt-2 text-xs">
                      {selKpi.lines.map((l) => <div key={l.label} className="flex justify-between"><span>{l.label}</span><span>{ugx(l.amount)}</span></div>)}
                      <div className="mt-1 flex justify-between font-medium"><span>Expected pay</span><span>{ugx(selKpi.expected)}</span></div>
                    </div>
                  </>
                )}
              </section>

              <div className="mt-5">
                {hrLevel ? (
                  <StaffFileForm userId={sel.user_id} mode="hr" canEditEmployment />
                ) : (
                  <StaffFileForm userId={sel.user_id} mode="view" canSeePrivate={false} />
                )}
              </div>

              {hrLevel && (
                <section className="surface mt-5 rounded-xl p-4">
                  <h3 className="display text-base">HR notes</h3>
                  <p className="text-xs text-ink-faint">Only HR, the MD, Founders and System Admin see these.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select className="field" value={noteKind} onChange={(e) => setNoteKind(e.target.value)}><option value="note">Note</option><option value="commendation">Commendation</option><option value="warning">Warning</option><option value="leave">Leave</option></select>
                    <input className="field flex-1" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What happened?" />
                    <button onClick={addNote} className="press rounded-full bg-signal px-4 py-2 text-sm text-background">Add</button>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {notes.filter((n) => n.user_id === sel.user_id).map((n) => (
                      <li key={n.id} className="rounded-lg border border-rule p-2"><span className="eyebrow text-[10px] text-ink-soft">{n.kind} · {new Date(n.created_at).toLocaleDateString()} · {members.find((m) => m.user_id === n.author_id)?.display_name ?? "HR"}</span><p>{n.body}</p></li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </SectionPage>
  );
}
