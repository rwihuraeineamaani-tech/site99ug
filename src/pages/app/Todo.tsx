import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Segmented, StatusChip } from "@/components/system";
import WaitingCard from "@/components/deck/WaitingCard";
import AssignWorkDialog from "@/components/todo/AssignWorkDialog";
import { Button } from "@/components/ui/button";
import { useTodo } from "@/hooks/useTodo";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadLeadershipTasks, personName, taskStatusLabel, type LeadershipTask, type StaffPerson, type TaskAssignee } from "@/lib/leadershipTasks";
import type { TodoKind, TodoItem } from "@/lib/todo";
import { cn } from "@/lib/utils";

const FILTERS: { value: "all" | "overdue" | "today" | "next" | TodoKind; label: string }[] = [
  { value: "all", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Today" }, { value: "next", label: "Next up" },
  { value: "leadership", label: "Assigned to me" }, { value: "content", label: "Content" }, { value: "shoots", label: "Shoots" }, { value: "approvals", label: "Approvals" }, { value: "strategy", label: "Strategy" }, { value: "finance", label: "Finance" }, { value: "operations", label: "Operations" }, { value: "sales", label: "Sales" },
];
const today = () => new Date().toISOString().slice(0, 10);
function urgency(item: TodoItem): "late" | "today" | "soon" { const due = item.due?.slice(0, 10); return due && due < today() ? "late" : due === today() ? "today" : "soon"; }
function dueLabel(item: TodoItem) { if (!item.due) return null; const d = item.due.slice(0, 10); if (d < today()) return "Overdue"; if (d === today()) return "Today"; return new Date(item.due).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }

export default function TodoPage() {
  const { items, loading, reload } = useTodo();
  const roles = useMyRoles();
  const [view, setView] = useState<"cards" | "list">(() => (localStorage.getItem("site99:todo-view") as "cards" | "list") || "cards");
  const [tab, setTab] = useState<"mine" | "assigned">("mine");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [assigned, setAssigned] = useState<LeadershipTask[]>([]);
  const [links, setLinks] = useState<TaskAssignee[]>([]);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!roles.userId || !roles.canAssignWork) return;
    let live = true;
    loadLeadershipTasks(roles.userId)
      .then((data) => { if (!live) return; setPeople(data.people); setResidents(data.residents); setAssigned(data.assigned); setLinks(data.assignees); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [roles.userId, roles.canAssignWork, beat]);

  const refreshAll = () => { reload(); setBeat((v) => v + 1); };
  const shown = useMemo(() => items.filter((item) => filter === "all" || (filter === "overdue" && urgency(item) === "late") || (filter === "today" && urgency(item) === "today") || (filter === "next" && urgency(item) === "soon") || item.kind === filter), [items, filter]);
  const setMode = (next: "cards" | "list") => { setView(next); localStorage.setItem("site99:todo-view", next); };
  const openAssigned = assigned.filter((t) => !["accepted", "cancelled"].includes(t.status));

  return <AppShell eyebrow="To-Do">
    <Seo title="To-Do — Site 99" description="Every action assigned to you across Site 99." path="/app/todo" noindex />
    <PageHeader eyebrow="To-Do" title="Your move." lede={loading ? "Loading your work…" : `${items.length} action${items.length === 1 ? "" : "s"} across assigned work, content, shoots, approvals, strategy, finance and operations.`} actions={<div className="flex flex-wrap gap-2">{roles.canAssignWork ? <AssignWorkDialog people={people} residents={residents} onCreated={refreshAll} /> : null}<Segmented value={view} onChange={setMode} options={[{ value: "cards", label: "Cards" }, { value: "list", label: "List" }]} /><Button variant="outline" size="sm" onClick={refreshAll}>Refresh</Button></div>} />

    {roles.canAssignWork ? <div className="mb-5"><Segmented value={tab} onChange={(v: "mine" | "assigned") => setTab(v)} options={[{ value: "mine", label: `My work (${items.length})` }, { value: "assigned", label: `Assigned by me (${openAssigned.length})` }]} /></div> : null}

    {tab === "assigned" && roles.canAssignWork ? (
      assigned.length === 0
        ? <div className="rounded-lg border border-rule py-16 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-acc-lime" /><h2 className="mt-3 font-semibold">Nothing assigned yet.</h2><p className="mt-1 text-sm text-ink-soft">Use “Assign work” to give someone a clear job.</p></div>
        : <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised">{assigned.map((task) => <Link key={task.id} to={`/app/todo/${task.id}`} className="grid gap-2 border-b border-rule px-4 py-4 last:border-0 hover:bg-paper-sunken focus-ring md:grid-cols-[1fr_200px_130px_110px] md:items-center">
            <div><div className="text-sm font-semibold">{task.title}</div><div className="text-xs text-ink-soft">{task.task_type.split("_").join(" ")} · {task.priority} priority</div></div>
            <span className="truncate text-xs text-ink-soft">{links.filter((l) => l.task_id === task.id).map((l) => personName(people, l.user_id)).join(", ") || "No assignee"}</span>
            <StatusChip value={taskStatusLabel(task.status)} tone={task.status === "submitted" ? "warn" : task.status === "accepted" ? "done" : "neutral"} />
            <span className="text-xs text-ink-faint">{task.due_at ? new Date(task.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "No deadline"}</span>
          </Link>)}</div>
    ) : <>
      <div className="mb-7 flex flex-wrap gap-2">{FILTERS.map((option) => <Button key={option.value} size="sm" variant={filter === option.value ? "default" : "outline"} onClick={() => setFilter(option.value)}>{option.label}<span className="num text-[10px]">{option.value === "all" ? items.length : items.filter((i) => option.value === "overdue" ? urgency(i) === "late" : option.value === "today" ? urgency(i) === "today" : option.value === "next" ? urgency(i) === "soon" : i.kind === option.value).length}</span></Button>)}</div>
      {!loading && shown.length === 0
        ? <div className="rounded-lg border border-rule py-16 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-acc-lime" /><h2 className="mt-3 font-semibold">All clear.</h2><p className="mt-1 text-sm text-ink-soft">Nothing is waiting in this view.</p></div>
        : view === "cards"
          ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((item) => <WaitingCard key={item.id} to={item.to} move={item.move} title={item.title} refLabel={item.kind} stage={item.detail ?? undefined} client={item.client} due={dueLabel(item)} urgency={urgency(item)} />)}</div>
          : <div className="overflow-hidden rounded-lg border border-rule bg-paper-raised"><div className="hidden grid-cols-[130px_1fr_170px_100px_70px] gap-3 border-b border-rule px-4 py-3 text-[10px] uppercase text-ink-faint md:grid"><span>Area</span><span>Action</span><span>Client / context</span><span>Due</span><span /></div>{shown.map((item) => <Link key={item.id} to={item.to} className="grid gap-2 border-b border-rule px-4 py-4 last:border-0 hover:bg-paper-sunken focus-ring md:grid-cols-[130px_1fr_170px_100px_70px] md:items-center"><StatusChip value={item.kind} tone="neutral" /><div><div className="text-sm font-semibold">{item.move}</div><div className="text-xs text-ink-soft">{item.title}</div></div><span className="truncate text-xs text-ink-soft">{item.client || item.detail || "Site 99"}</span><span className={cn("text-xs", urgency(item) === "late" ? "text-signal" : "text-ink-faint")}>{dueLabel(item) || "Next up"}</span><span className="text-xs text-signal">Open →</span></Link>)}</div>}
    </>}
  </AppShell>;
}
