import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyResident = {
  id: string;
  name: string;
  territory: string;
  since: string;
  status: string;
  email: string | null;
  avatar_url: string | null;
};

export const useResidentMe = () =>
  useQuery({
    queryKey: ["resident-me"],
    queryFn: async (): Promise<MyResident | null> => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return null;
      // Try to claim invite (idempotent). Ignored if not invited.
      await supabase.rpc("accept_resident_invite");
      const { data, error } = await supabase
        .from("residents")
        .select("id,name,territory,since,status,email,avatar_url")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as MyResident | null;
    },
  });
