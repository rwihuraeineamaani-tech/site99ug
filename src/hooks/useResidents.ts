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
  visible: boolean;
};

/**
 * Admin / authenticated read of the full residents table (includes email).
 * Requires admin role or own-row access via RLS.
 */
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

export type PublicResident = {
  id: string;
  name: string;
  territory: string;
  since: string;
  status: string;
  display_order: number;
  avatar_url: string | null;
  visible: boolean;
};

/**
 * Public read through a safe database function — no email, no user_id,
 * and only visible clients. Safe for anonymous visitors.
 */
export const usePublicResidents = () =>
  useQuery({
    queryKey: ["residents-public"],
    queryFn: async (): Promise<PublicResident[]> => {
      const { data, error } = await (supabase as any).rpc("list_public_residents");
      if (error) throw error;
      return (data as PublicResident[]) ?? [];
    },
  });
