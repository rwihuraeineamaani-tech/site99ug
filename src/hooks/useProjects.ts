import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  title: string;
  client: string;
  year: string;
  tag: string;
  description: string | null;
  cover_url: string;
  gallery_urls: string[];
  external_url: string | null;
  display_order: number;
};

export const useProjects = () =>
  useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });
