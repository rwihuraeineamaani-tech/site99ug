import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Message = {
  id: string;
  resident_id: string;
  sender_role: "admin" | "resident";
  body: string;
  created_at: string;
  read_at: string | null;
};

export const useMessages = (residentId?: string | null) =>
  useQuery({
    queryKey: ["messages", residentId],
    enabled: !!residentId,
    refetchInterval: 15000,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("resident_id", residentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });
