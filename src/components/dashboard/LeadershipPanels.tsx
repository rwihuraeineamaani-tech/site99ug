import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DeckPanel, DeckList } from "@/components/deck";
import { StatusChip } from "@/components/system";
import { loadLeadershipTasks, personName, taskStatusLabel, type LeadershipTask, type StaffPerson, type TaskAssignee } from "@/lib/leadershipTasks";
import { isOverdue, todayISO } from "@/lib/deck";

type Bundle = { tasks: LeadershipTask[]; assignees: TaskAssignee[]; people: StaffPerson[] };

/** Everything a leader assigned, loaded once and shared by the leadership panels. */
export function useAssignedWork(userId: string | null) {
  const [bundle, setBundle] = useState<Bundle>({ tasks: [], assignees: [], people: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await loadLeadershipTasks(userId);
      setBundle({ tasks: data.assigned, assignees: data.assignees, people: data.people });
    } catch {
      setBundle({ tasks: [], assignees: [], people: [] });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...bundle, loading, reload: load };
}

export type AssignedWork = ReturnType<typeof useAssignedWork>;

const OPEN = ["assigned", "in_progress", "submitted", "returned"];

function names(work: AssignedWork, taskId: string) {
  const ids = work.assignees.filter((a) => a.task_id === taskId).map((a) => a.user_id);
  if (!ids.length) return "Nobody yet";
  return ids.map((id) => personName(work.people, id)).join(", ");
}

function dueLabel(due: string | null) {
  if (!due) return "No deadline";
  const day = due.slice(0, 10);
  if (day === todayISO()) return "Due today";
  if (isOverdue(due)) return `Late — was due ${new Date(due).toLocaleDateString()}`;
  return `Due ${new Date(due).toLocaleDateString()}`;
}

function statusTone(status: string): "done" | "warn" | "neutral" {
  if (status === "accepted") return "done";
  if (status === "returned" || status === "submitted") return "warn";
  return "neutral";
}

/** Panel: every task this leader gave out, with progress at a glance. */
export function AssignedWorkPanel({ work, index = "01" }: { work: AssignedWork; index?: string }) {
  const open = work.tasks.filter((t) => OPEN.includes(t.status));
  const done = work.tasks.filter((t) => t.status === "accepted").length;
  const late = open.filter((t) => t.due_at && isOverdue(t.due_at)).length;
  const total = work.tasks.filter((t) => t.status !== "cancelled").length;
  const donePct = total ? Math.round((done / total) * 100) : 0;
  const latePct = total ? Math.round((late / total) * 100) : 0;

  return (
    <DeckPanel
      index={index}
      title="Work I assigned"
      hint={work.loading ? "Loading…" : `${open.length} open · ${done} done${late ? ` · ${late} late` : ""}`}
    >
      <div className="px-4 pt-4">
        <div className="h-2 w-full rounded-full bg-paper-sunken overflow-hidden flex">
          <div className="h-full bg-acc-lime" style={{ width: `${donePct}%` }} />
          <div className="h-full bg-signal" style={{ width: `${latePct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          {donePct}% finished{late ? `, ${latePct}% late` : ""} out of {total} task{total === 1 ? "" : "s"}
        </p>
      </div>
      <DeckList>
        {open.length === 0 && !work.loading && (
          <li className="px-4 py-6 text-sm text-ink-soft">Nothing open. Use Assign work in To-Do to give something out.</li>
        )}
        {open.map((task) => (
          <li key={task.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={`/app/todo/${task.id}`} className="text-sm font-semibold hover:text-signal focus-ring">
              {task.title}
            </Link>
            <span className="text-xs text-ink-faint truncate">{names(work, task.id)}</span>
            <StatusChip value={taskStatusLabel(task.status)} tone={statusTone(task.status)} />
            <span
              className={`ml-auto text-xs whitespace-nowrap ${
                task.due_at && isOverdue(task.due_at) ? "text-signal" : "text-ink-faint"
              }`}
            >
              {dueLabel(task.due_at)}
            </span>
          </li>
        ))}
      </DeckList>
    </DeckPanel>
  );
}

/** Panel: submitted work waiting for this leader to accept or send back. */
export function SignOffPanel({ work, index = "01" }: { work: AssignedWork; index?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const waiting = work.tasks.filter((t) => t.status === "submitted");

  const decide = async (taskId: string, decision: "accept" | "return") => {
    let feedback: string | null = null;
    if (decision === "return") {
      feedback = window.prompt("What should they fix or add?")?.trim() || null;
      if (!feedback) return toast.error("Add a note before sending work back.");
    }
    setBusy(taskId);
    const { error } = await supabase.rpc("decide_leadership_task", {
      _task_id: taskId,
      _decision: decision,
      _feedback: feedback,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(decision === "accept" ? "Work accepted." : "Work sent back.");
    work.reload();
  };

  return (
    <DeckPanel index={index} title="Waiting for my sign-off" hint={`${waiting.length} submitted`}>
      <DeckList>
        {waiting.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">Nothing waiting on your sign-off.</li>}
        {waiting.map((task) => (
          <li key={task.id} className="px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/app/todo/${task.id}`} className="text-sm font-semibold hover:text-signal focus-ring">
                {task.title}
              </Link>
              <span className="text-xs text-ink-faint">{names(work, task.id)}</span>
              <span className="ml-auto text-xs text-ink-faint">
                {task.submitted_at ? `Sent ${new Date(task.submitted_at).toLocaleDateString()}` : ""}
              </span>
            </div>
            {task.submitted_update && <p className="text-xs text-ink-soft line-clamp-2">{task.submitted_update}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === task.id}
                onClick={() => decide(task.id, "accept")}
                className="press rounded-md border border-acc-lime/60 bg-acc-lime/10 px-3 py-1 text-[11px] text-acc-lime focus-ring disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy === task.id}
                onClick={() => decide(task.id, "return")}
                className="press rounded-md border border-rule px-3 py-1 text-[11px] text-ink-soft hover:text-signal focus-ring disabled:opacity-50"
              >
                Send back
              </button>
              <Link to={`/app/todo/${task.id}`} className="ml-auto text-[11px] text-signal focus-ring">
                Open task →
              </Link>
            </div>
          </li>
        ))}
      </DeckList>
    </DeckPanel>
  );
}

/** Panel: how much open work each person is carrying. */
export function TeamLoadPanel({ work, index = "01" }: { work: AssignedWork; index?: string }) {
  const rows = useMemo(() => {
    const open = work.tasks.filter((t) => OPEN.includes(t.status));
    const map = new Map<string, { open: number; late: number }>();
    open.forEach((task) => {
      work.assignees
        .filter((a) => a.task_id === task.id)
        .forEach((a) => {
          const row = map.get(a.user_id) ?? { open: 0, late: 0 };
          row.open += 1;
          if (task.due_at && isOverdue(task.due_at)) row.late += 1;
          map.set(a.user_id, row);
        });
    });
    return [...map.entries()]
      .map(([userId, counts]) => ({ userId, ...counts }))
      .sort((a, b) => b.open - a.open);
  }, [work.tasks, work.assignees]);

  const busiest = rows[0]?.open ?? 1;

  return (
    <DeckPanel index={index} title="Team load" hint={`${rows.length} people carrying work`}>
      <DeckList>
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">Nobody is carrying assigned work right now.</li>}
        {rows.map((row) => (
          <li key={row.userId} className="px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-semibold w-40 truncate">{personName(work.people, row.userId)}</span>
            <div className="flex-1 h-2 rounded-full bg-paper-sunken overflow-hidden">
              <div className="h-full bg-signal/70" style={{ width: `${Math.round((row.open / busiest) * 100)}%` }} />
            </div>
            <span className="num text-xs whitespace-nowrap">
              {row.open} open{row.late ? ` · ${row.late} late` : ""}
            </span>
          </li>
        ))}
      </DeckList>
    </DeckPanel>
  );
}
