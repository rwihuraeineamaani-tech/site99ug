import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  published: boolean;
  created_at: string;
};

export const useAnnouncements = (onlyPublished = false) =>
  useQuery({
    queryKey: ["announcements", onlyPublished],
    queryFn: async (): Promise<Announcement[]> => {
      let q = supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (onlyPublished) q = q.eq("published", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Announcement[];
    },
  });
