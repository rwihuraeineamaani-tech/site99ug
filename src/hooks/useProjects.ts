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
  youtube_url?: string | null;
  aspect_ratio?: string | null;
};

export const useProjects = () =>
  useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      // Public showcase read through a safe function (visitors can't read the projects table directly).
      const { data, error } = await (supabase as any).rpc("list_public_projects");
      if (error) throw error;
      return ((data as Project[]) ?? []).map((p) => ({ ...p, gallery_urls: p.gallery_urls ?? [] }));
    },
  });
