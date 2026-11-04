import { supabase } from "@/integrations/supabase/client";

export type SiteLogo = {
  id: string;
  name: string;
  image_path: string;
  bucket: string;
  link_url: string | null;
  sort_order: number;
  visible: boolean;
};

export async function siteLogoUrl(l: Pick<SiteLogo, "image_path" | "bucket">): Promise<string | null> {
  if (/^https?:\/\//i.test(l.image_path)) return l.image_path;
  const { data } = await supabase.storage.from(l.bucket).createSignedUrl(l.image_path, 3600);
  return data?.signedUrl ?? null;
}

export async function loadSiteLogos(includeHidden = false) {
  let q = supabase.from("site_logos").select("*").order("sort_order").order("created_at");
  if (!includeHidden) q = q.eq("visible", true);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as SiteLogo[];
  let urls: (string | null)[];
  if (!includeHidden) {
    // Public visitors: signed URLs come from a server function (no public storage read rule).
    const { data: res } = await supabase.functions.invoke("site-logo-urls");
    const map = (res?.urls ?? {}) as Record<string, string>;
    urls = rows.map((r) => map[r.id] ?? (/^https?:\/\//i.test(r.image_path) ? r.image_path : null));
  } else {
    urls = await Promise.all(rows.map(siteLogoUrl));
  }
  return rows.map((r, i) => ({ ...r, url: urls[i] }));
}
