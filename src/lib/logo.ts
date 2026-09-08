import { supabase } from "@/integrations/supabase/client";

/** Turn a stored logo value into something an <img> can use.
 *  Older records hold a full URL; new ones hold a path inside the private logo store. */
export async function logoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from("client-logos").createSignedUrl(value, 3600);
  return data?.signedUrl ?? null;
}

export async function logoUrls(values: { id: string; avatar_url: string | null }[]) {
  const out: Record<string, string> = {};
  await Promise.all(
    values.map(async (v) => {
      const url = await logoUrl(v.avatar_url);
      if (url) out[v.id] = url;
    })
  );
  return out;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
