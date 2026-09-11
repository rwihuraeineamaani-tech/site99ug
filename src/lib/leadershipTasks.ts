import { supabase } from "@/integrations/supabase/client";

export const TASK_TYPES = ["general", "contract", "sales", "report", "call", "finance", "content", "strategy", "operations"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type LeadershipTask = {
  id: string; title: string; instruction: string; task_type: string; priority: string; status: string;
  assigned_by: string; due_at: string | null; private_notes: string | null; entity_type: string | null;
  entity_id: string | null; work_path: string | null; resident_id: string | null;
  require_written_update: boolean; require_file_or_link: boolean; require_signoff: boolean;
  submitted_update: string | null; clarification_request: string | null; leader_feedback: string | null;
  submitted_at: string | null; accepted_at: string | null; created_at: string; updated_at: string;
};
export type TaskAssignee = { id: string; task_id: string; user_id: string; assigned_at: string };
export type TaskEvidence = { id: string; task_id: string; added_by: string; kind: string; label: string; url: string | null; storage_path: string | null; created_at: string };
export type TaskActivity = { id: string; task_id: string; actor_user_id: string | null; event_type: string; detail: string | null; created_at: string };
export type StaffPerson = { user_id: string; display_name: string | null; email: string | null; title: string | null };

export async function loadLeadershipTasks(userId: string) {
  const [{ data: tasks, error }, { data: assignees }, { data: people }, { data: residents }] = await Promise.all([
    supabase.from("leadership_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("leadership_task_assignees").select("*"),
    supabase.from("team_members").select("user_id,display_name,email,title").not("user_id", "is", null).order("display_name"),
    supabase.from("residents").select("id,name").order("name"),
  ]);
  if (error) throw error;
  const rows = (tasks as LeadershipTask[]) ?? [];
  const links = (assignees as TaskAssignee[]) ?? [];
  return {
    tasks: rows,
    assignees: links,
    mine: rows.filter((task) => links.some((a) => a.task_id === task.id && a.user_id === userId)),
    assigned: rows.filter((task) => task.assigned_by === userId),
    people: (people as StaffPerson[]) ?? [],
    residents: (residents as { id: string; name: string }[]) ?? [],
  };
}

export async function loadLeadershipTask(id: string) {
  const [{ data: task, error }, { data: assignees }, { data: evidence }, { data: activity }, { data: people }] = await Promise.all([
    supabase.from("leadership_tasks").select("*").eq("id", id).maybeSingle(),
    supabase.from("leadership_task_assignees").select("*").eq("task_id", id),
    supabase.from("leadership_task_evidence").select("*").eq("task_id", id).order("created_at"),
    supabase.from("leadership_task_activity").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("team_members").select("user_id,display_name,email,title").not("user_id", "is", null),
  ]);
  if (error) throw error;
  return { task: task as LeadershipTask | null, assignees: (assignees as TaskAssignee[]) ?? [], evidence: (evidence as TaskEvidence[]) ?? [], activity: (activity as TaskActivity[]) ?? [], people: (people as StaffPerson[]) ?? [] };
}

export async function evidenceUrl(item: TaskEvidence) {
  if (item.url) return item.url;
  if (!item.storage_path) return null;
  const { data, error } = await supabase.storage.from("task-evidence").createSignedUrl(item.storage_path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export function personName(people: StaffPerson[], id: string | null) {
  const person = people.find((p) => p.user_id === id);
  return person?.display_name || person?.email || "Team member";
}

export function taskStatusLabel(status: string) {
  return status.split("_").join(" ").replace(/^./, (letter) => letter.toUpperCase());
}