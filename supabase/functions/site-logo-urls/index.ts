import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns short-lived signed URLs for visible website logos only.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin
      .from("site_logos")
      .select("id, image_path, bucket")
      .eq("visible", true)
      .in("bucket", ["site-logos", "client-logos"]);
    if (error) throw error;
    const urls: Record<string, string> = {};
    await Promise.all((data ?? []).map(async (l) => {
      if (/^https?:\/\//i.test(l.image_path)) { urls[l.id] = l.image_path; return; }
      const { data: s } = await admin.storage.from(l.bucket || "site-logos").createSignedUrl(l.image_path, 3600);
      if (s?.signedUrl) urls[l.id] = s.signedUrl;
    }));
    return new Response(JSON.stringify({ urls }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Could not load logos" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
