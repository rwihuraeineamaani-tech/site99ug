import { supabase } from "@/integrations/supabase/client";

export type ChatPerson = { user_id: string; display_name: string; person_kind: "staff" | "client"; subtitle: string };
export type ChatMessage = { id: string; thread_id: string; sender_id: string; body: string; created_at: string; edited_at: string | null };
export type ChatThread = {
  id: string;
  updated_at: string;
  person: ChatPerson;
  lastMessage: ChatMessage | null;
  unread: number;
};

type ThreadRow = { id: string; updated_at: string };
type ParticipantRow = { thread_id: string; user_id: string; last_read_at: string };

export async function loadChatPeople(): Promise<ChatPerson[]> {
  const { data, error } = await supabase.rpc("chat_people");
  if (error) throw error;
  return ((data as unknown as ChatPerson[]) ?? []).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export async function loadChatThreads(userId: string): Promise<ChatThread[]> {
  const [{ data: memberships, error: membershipError }, people] = await Promise.all([
    supabase.from("chat_participants").select("thread_id,user_id,last_read_at"),
    loadChatPeople(),
  ]);
  if (membershipError) throw membershipError;
  const mine = ((memberships as unknown as ParticipantRow[]) ?? []).filter((p) => p.user_id === userId);
  if (!mine.length) return [];
  const ids = mine.map((p) => p.thread_id);
  const [{ data: threads, error: threadError }, { data: participants }, { data: messages, error: messageError }] = await Promise.all([
    supabase.from("chat_threads").select("id,updated_at").in("id", ids).order("updated_at", { ascending: false }),
    supabase.from("chat_participants").select("thread_id,user_id,last_read_at").in("thread_id", ids),
    supabase.from("chat_messages").select("id,thread_id,sender_id,body,created_at,edited_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(500),
  ]);
  if (threadError) throw threadError;
  if (messageError) throw messageError;
  const allParts = (participants as unknown as ParticipantRow[]) ?? [];
  const allMessages = (messages as unknown as ChatMessage[]) ?? [];
  const directory = new Map(people.map((p) => [p.user_id, p]));
  return ((threads as unknown as ThreadRow[]) ?? []).map((thread) => {
    const otherId = allParts.find((p) => p.thread_id === thread.id && p.user_id !== userId)?.user_id ?? "";
    const ownRead = mine.find((p) => p.thread_id === thread.id)?.last_read_at ?? "";
    const threadMessages = allMessages.filter((m) => m.thread_id === thread.id);
    return {
      ...thread,
      person: directory.get(otherId) ?? { user_id: otherId, display_name: "Conversation", person_kind: "staff", subtitle: "Site 99" },
      lastMessage: threadMessages[0] ?? null,
      unread: threadMessages.filter((m) => m.sender_id !== userId && m.created_at > ownRead).length,
    };
  });
}

export async function openDirectChat(targetUser: string): Promise<string> {
  const { data, error } = await supabase.rpc("open_direct_chat", { _target_user: targetUser });
  if (error) throw error;
  if (!data) throw new Error("The conversation could not be opened.");
  return String(data);
}

export async function loadThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,body,created_at,edited_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as ChatMessage[]) ?? [];
}

export async function sendChatMessage(threadId: string, userId: string, body: string) {
  const { error } = await supabase.from("chat_messages").insert({ thread_id: threadId, sender_id: userId, body: body.trim() } as never);
  if (error) throw error;
}

export async function markChatRead(threadId: string, userId: string) {
  const { error } = await supabase
    .from("chat_participants")
    .update({ last_read_at: new Date().toISOString() } as never)
    .eq("thread_id", threadId)
    .eq("user_id", userId);
  if (error) throw error;
}
