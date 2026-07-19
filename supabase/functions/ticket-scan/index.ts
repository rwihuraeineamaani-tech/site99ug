import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const { qrToken } = await req.json();
    if (!qrToken) return json({ error: "Missing qrToken" }, 400);

    const { data: ticket } = await admin
      .from("tickets")
      .select("id, status, holder_name, tier_id, order_id, tier:ticket_tiers(name, event:events(title))")
      .eq("qr_token", qrToken)
      .maybeSingle();

    if (!ticket) return json({ ok: false, reason: "not_found" });
    if (ticket.status === "used") return json({ ok: false, reason: "already_used", ticket });
    if (ticket.status !== "valid") return json({ ok: false, reason: ticket.status, ticket });

    const { error: upErr } = await admin
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString(), used_by: userId })
      .eq("id", ticket.id)
      .eq("status", "valid");
    if (upErr) return json({ ok: false, reason: "update_failed", error: upErr.message });

    return json({ ok: true, ticket });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
