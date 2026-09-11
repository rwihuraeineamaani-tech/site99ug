import { supabase } from "@/integrations/supabase/client";

export type CommunicationKind = "brief" | "announcement";

export async function markCommunicationRead(userId: string, kind: CommunicationKind, entityId: string) {
  const { error } = await supabase.from("communication_reads").upsert(
    { user_id: userId, entity_kind: kind, entity_id: entityId, read_at: new Date().toISOString() } as never,
    { onConflict: "user_id,entity_kind,entity_id" }
  );
  if (error) throw error;
}

export async function loadCommunicationReads(userId: string, kind: CommunicationKind) {
  const { data, error } = await supabase.from("communication_reads").select("entity_id").eq("user_id", userId).eq("entity_kind", kind);
  if (error) throw error;
  return new Set(((data as { entity_id: string }[]) ?? []).map((row) => row.entity_id));
}
