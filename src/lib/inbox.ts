import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/deck";
import type { AppRole } from "@/hooks/useMyRoles";

/** A piece of content as the inbox and the dashboard both read it. */
export type FlowRow = {
  id: string;
  ref_no: number;
  title: string;
  stage: string;
  resident_id: string | null;
  shoot_at: string | null;
  planned_at: string | null;
  metrics_due_at: string | null;
};

export type ResidentLink = { id: string; name: string; contact_user_id: string | null; handler_user_id: string | null };

export type WaitingJob = { item: FlowRow; why: string; weight: number; due: string | null };

/** Everything that is genuinely this person's move, most urgent first. */
export function buildWaiting({
  userId,
  flow,
  resLinks,
  myCrew,
  isFounder,
  amContact,
  amHandler,
}: {
  userId: string | null;
  flow: FlowRow[];
  resLinks: ResidentLink[];
  myCrew: { content_id: string; role: string }[];
  isFounder: boolean;
  amContact: (residentId: string | null) => boolean;
  amHandler: (residentId: string | null) => boolean;
}): WaitingJob[] {
  if (!userId) return [];
  const today = todayISO();
  const resById = new Map(resLinks.map((r) => [r.id, r]));
  const editorOf = new Set(myCrew.filter((c) => /edit/i.test(c.role)).map((c) => c.content_id));

  const out: WaitingJob[] = [];
  flow.forEach((i) => {
    const r = i.resident_id ? resById.get(i.resident_id) : undefined;
    const contact = r?.contact_user_id === userId || amContact(i.resident_id);
    const handler = r?.handler_user_id === userId || amHandler(i.resident_id);
    const push = (why: string, weight: number, due: string | null = i.planned_at) =>
      out.push({ item: i, why, weight, due });

    switch (i.stage) {
      case "Idea":
        if (isFounder) push("Approve or reject", 3);
        break;
      case "Approved":
        if (contact || isFounder) push("Fill the production team", 3);
        break;
      case "Crewed":
        if (contact || isFounder) push("Set the shoot date", 2);
        break;
      case "Scheduled":
        if ((contact || isFounder) && i.shoot_at && i.shoot_at.slice(0, 10) <= today) push("Shoot day", 0, i.shoot_at);
        break;
      case "Shooting":
        if (contact || isFounder) push("Send to post production", 1);
        break;
      case "Editing":
        if (editorOf.has(i.id)) push("Edit and deliver", 1);
        break;
      case "Review":
        if (isFounder) push("Sign off the cut", 1);
        break;
      case "Handover":
        if (handler || isFounder) push("Post it", 1);
        break;
      case "Posted":
        if ((handler || isFounder) && i.metrics_due_at && i.metrics_due_at.slice(0, 10) <= today)
          push("Add the numbers", 2, i.metrics_due_at);
        break;
    }
  });
  return out.sort((a, b) => a.weight - b.weight || (a.due ?? "9").localeCompare(b.due ?? "9"));
}

/** The three lists the "waiting on you" workings need. */
export async function loadWaitingRaw(userId: string) {
  const [{ data: rows }, { data: rs }, { data: cw }] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, ref_no, title, stage, resident_id, shoot_at, planned_at, metrics_due_at")
      .not("stage", "in", '("Archived","Rejected")'),
    supabase.rpc("resident_options"),
    supabase.from("content_crew").select("content_id, role").eq("user_id", userId),
  ]);
  return {
    flow: ((rows as unknown as FlowRow[]) ?? []),
    resLinks: ((rs as unknown as ResidentLink[]) ?? []),
    myCrew: ((cw as { content_id: string; role: string }[]) ?? []),
  };
}

/* ---------- stored inbox messages ---------- */

export type InboxKind = "message" | "brief" | "announcement" | "client_message";

export type InboxMessage = {
  id: string;
  kind: InboxKind;
  subject: string;
  body: string | null;
  author: string | null;
  audience: "person" | "role" | "everyone";
  target_user: string | null;
  target_role: AppRole | null;
  resident_id: string | null;
  shoot_day_id: string | null;
  content_id: string | null;
  link_path: string | null;
  parent_id: string | null;
  created_at: string;
};

export const KIND_LABEL: Record<InboxKind, string> = {
  message: "Message",
  brief: "Shoot brief",
  announcement: "Announcement",
  client_message: "Client message",
};

export const KIND_TONE: Record<InboxKind, "violet" | "teal" | "amber" | "blue"> = {
  message: "violet",
  brief: "teal",
  announcement: "amber",
  client_message: "blue",
};

export type InboxFilter = "all" | "unread" | "waiting" | "brief" | "announcement" | "message";

/** Everything addressed to this person, newest first, plus which ones they've opened. */
export async function loadInboxMessages(userId: string) {
  const [{ data: rows, error }, { data: reads }] = await Promise.all([
    supabase.from("inbox_messages").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("inbox_reads").select("message_id").eq("user_id", userId),
  ]);
  if (error) throw error;
  return {
    messages: ((rows as unknown as InboxMessage[]) ?? []),
    read: new Set(((reads as { message_id: string }[]) ?? []).map((r) => r.message_id)),
  };
}

export async function markRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  await supabase.from("inbox_reads").upsert(
    ids.map((message_id) => ({ message_id, user_id: userId })) as never,
    { onConflict: "message_id,user_id", ignoreDuplicates: true }
  );
}

/** How long ago, in words. */
export function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
