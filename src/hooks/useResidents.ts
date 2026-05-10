import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Resident = {
  id: string;
  name: string;
  territory: string;
  since: string;
  status: string;
  display_order: number;
  email: string | null;
  user_id: string | null;
};

export const useResidents = () =>
  useQuery({
    queryKey: ["residents"],
    queryFn: async (): Promise<Resident[]> => {
      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Resident[];
    },
  });
