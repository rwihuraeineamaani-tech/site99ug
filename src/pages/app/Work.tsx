import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Segmented, StatusChip } from "@/components/system";
import StatCard from "@/components/admin/StatCard";
import AssignWorkDialog from "@/components/todo/AssignWorkDialog";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadLeadershipTasks, personName, type LeadershipTask, type StaffPerson, type TaskAssignee } from "@/lib/leadershipTasks";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const dueLabel = (task: LeadershipTask) => {
  if (!task.due_at) return "No deadline";
  const d = task.due_at.slice(0, 10);
  if (d < today()) return "Overdue";
  if (d === today()) return "Due today";
  return new Date(task.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const isLate = (task: LeadershipTask) =>
  Boolean(task.due_at) && task.due_at!.slice(0, 10) < today() && !["accepted", "cancelled"].includes(task.status);

const COLUMNS: { key: string; label: string; hint: string; match: (t: LeadershipTask) => boolean }[] = [
  { key: "new", label: "Not started", hint: "Sent, not picked up yet", match: (t) => t.status === "assigned" },
  { key: "doing", label: "Being done", hint: "Someone is on it", match: (t) => ["accepted_by_assignee", "in_progress", "clarification"].includes(t.status) },
  { key: "check", label: "Waiting on you", hint: "Sent back for sign-off", match: (t) => ["submitted", "returned"].includes(t.status) },
  { key: "done", label: "Signed off", hint: "Closed in the last while", match: (t) => t.status === "accepted" },
];

export default function WorkPage() {
  const roles = useMyRoles();
  const [tab, setTab] = useState<"board" | "people">("board");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<LeadershipTask[]>([]);
  const [links, setLinks] = useState<TaskAssignee[]>([]);
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!roles.userId) return;
    let live = true;
    setLoading(true);
    loadLeadershipTasks(roles.userId)
      .then((data) => {
        if (!live) return;
        setTasks(data.tasks);
        setLinks(data.assignees);
        setPeople(data.people);
        setResidents(data.residents);
      })
      .catch(() => undefined)
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [roles.userId, beat]);

  const visible = useMemo(
    () => (scope === "mine" ? tasks.filter((t) => t.assigned_by === roles.userId) : tasks),
    [tasks, scope, roles.userId],
  );
  const open = visible.filter((t) => !["accepted", "cancelled"].includes(t.status));
  const late = open.filter(isLate);
  const waiting = visible.filter((t) => ["submitted", "returned"].includes(t.status));

  const load = useMemo(() => {
    const rows = people.map((p) => {
      const own = visible.filter((t) => links.some((l) => l.task_id === t.id && l.user_id === p.user_id));
      return {
        person: p,
        open: own.filter((t) => !["accepted", "cancelled"].includes(t.status)).length,
        late: own.filter(isLate).length,
        waiting: own.filter((t) => ["submitted", "returned"].includes(t.status)).length,
        done: own.filter((t) => t.status === "accepted").length,
      };
    });
    return rows.filter((r) => r.open + r.done > 0).sort((a, b) => b.open - a.open || b.late - a.late);
  }, [people, visible, links]);

  if (!roles.loading && !roles.canAssignWork) return <Navigate to="/app/todo" replace />;

  const names = (task: LeadershipTask) =>
    links.filter((l) => l.task_id === task.id).map((l) => personName(people, l.user_id)).join(", ") || "No one yet";

  return <AppShell eyebrow="Work">
    <Seo title="Work — Site 99" description="Assign work and follow every job through to sign-off." path="/app/work" noindex />
    <PageHeader
      eyebrow="Work"
      title="Assign it. Follow it."
      lede={loading ? "Loading assigned work…" : `${open.length} job${open.length === 1 ? "" : "s"} still running, ${late.length} past the deadline, ${waiting.length} waiting for your sign-off.`}
      actions={<div className="flex flex-wrap gap-2">
        <AssignWorkDialog people={people} residents={residents} onCreated={() => setBeat((v) => v + 1)} />
        <Button variant="outline" size="sm" onClick={() => setBeat((v) => v + 1)}>Refresh</Button>
      </div>}
    />

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Running" value={String(open.length)} hint="not finished yet" />
      <StatCard label="Past deadline" value={String(late.length)} hint="needs a nudge" />
      <StatCard label="Waiting on you" value={String(waiting.length)} hint="ready for sign-off" />
      <StatCard label="Signed off" value={String(visible.filter((t) => t.status === "accepted").length)} hint="closed jobs" />
    </div>

    <div className="mb-5 flex flex-wrap gap-2">
      <Segmented value={tab} onChange={(v: "board" | "people") => setTab(v)} options={[{ value: "board", label: "Board" }, { value: "people", label: "By person" }]} />
      <Segmented value={scope} onChange={(v: "mine" | "all") => setScope(v)} options={[{ value: "mine", label: "Given by me" }, { value: "all", label: "Everything I can see" }]} />
    </div>

    {tab === "board" ? (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const rows = visible.filter(column.match);
          return <section key={column.key} className="rounded-lg border border-rule bg-paper-raised p-3">
            <header className="mb-3 flex items-baseline justify-between">
              <div>
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <p className="text-[11px] text-ink-faint">{column.hint}</p>
              </div>
              <span className="num text-xs text-ink-soft">{rows.length}</span>
            </header>
            {rows.length === 0
              ? <p className="rounded-md border border-dashed border-rule px-3 py-6 text-center text-xs text-ink-faint">Nothing here.</p>
              : <div className="grid gap-2">{rows.map((task) => <Link key={task.id} to={`/app/todo/${task.id}`} className="block rounded-md border border-rule bg-paper-sunken p-3 hover:border-signal focus-ring">
                  <div className="text-sm font-semibold">{task.title}</div>
                  <div className="mt-1 text-xs text-ink-soft">{names(task)}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip value={task.task_type.split("_").join(" ")} tone="neutral" />
                    <span className={cn("text-[11px]", isLate(task) ? "text-signal" : "text-ink-faint")}>{dueLabel(task)}</span>
                    {task.priority === "urgent" || task.priority === "high" ? <span className="text-[11px] uppercase text-acc-lime">{task.priority}</span> : null}
                  </div>
                </Link>)}</div>}
          </section>;
        })}
      </div>
    ) : (
      load.length === 0
        ? <div className="rounded-lg border border-rule py-16 text-center"><ClipboardList className="mx-auto h-8 w-8 text-ink-faint" /><h2 className="mt-3 font-semibold">No work assigned yet.</h2><p className="mt-1 text-sm text-ink-soft">Use “Assign work” to give someone a clear job.</p></div>
        : <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised">
            <div className="hidden grid-cols-[1fr_90px_90px_110px_90px] gap-3 border-b border-rule px-4 py-3 text-[10px] uppercase text-ink-faint md:grid"><span>Person</span><span>Running</span><span>Late</span><span>For sign-off</span><span>Done</span></div>
            {load.map((row) => <div key={row.person.user_id} className="grid gap-1 border-b border-rule px-4 py-4 last:border-0 md:grid-cols-[1fr_90px_90px_110px_90px] md:items-center">
              <div><div className="text-sm font-semibold">{row.person.display_name || row.person.email}</div><div className="text-xs text-ink-faint">{row.person.title || "Team member"}</div></div>
              <span className="num text-sm">{row.open}<span className="md:hidden text-xs text-ink-faint"> running</span></span>
              <span className={cn("num text-sm", row.late ? "text-signal" : "")}>{row.late}<span className="md:hidden text-xs text-ink-faint"> late</span></span>
              <span className="num text-sm">{row.waiting}<span className="md:hidden text-xs text-ink-faint"> for sign-off</span></span>
              <span className="num text-sm text-ink-soft">{row.done}<span className="md:hidden text-xs text-ink-faint"> done</span></span>
            </div>)}
          </div>
    )}

    {!loading && visible.length === 0 && tab === "board" ? <p className="mt-6 text-center text-sm text-ink-soft">Nothing assigned yet — start with “Assign work” at the top.</p> : null}
  </AppShell>;
}
