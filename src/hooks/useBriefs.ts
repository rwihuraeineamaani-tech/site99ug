import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Brief = {
  id: string;
  resident_id: string;
  title: string;
  body: string | null;
  file_url: string | null;
  created_at: string;
};

export const useBriefs = (residentId?: string | null) =>
  useQuery({
    queryKey: ["briefs", residentId ?? "all"],
    enabled: residentId !== undefined,
    queryFn: async (): Promise<Brief[]> => {
      let q = supabase.from("briefs").select("*").order("created_at", { ascending: false });
      if (residentId) q = q.eq("resident_id", residentId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Brief[];
    },
  });
