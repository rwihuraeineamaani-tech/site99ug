import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { eventId, items, buyer, tid, provider } = await req.json();

    if (!eventId || !Array.isArray(items) || !items.length || !buyer?.email || !buyer?.phone || !buyer?.name) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!tid || String(tid).trim().length < 4) return json({ error: "Enter the Transaction ID (TID) from your MoMo/Airtel confirmation SMS" }, 400);
    if (!["momo", "airtel", "other"].includes(provider)) return json({ error: "Choose MoMo or Airtel" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: event, error: eErr } = await sb.from("events").select("id,title,published,age_limit,manual_enabled").eq("id", eventId).single();
    if (eErr || !event || !event.published) return json({ error: "Event unavailable" }, 404);
    if (event.manual_enabled === false) return json({ error: "Manual TID payment is temporarily closed for this event." }, 400);
    const buyerAge = Number(buyer.age);
    if (event.age_limit && (!buyerAge || buyerAge < event.age_limit)) {
      return json({ error: `This event is restricted to ${event.age_limit}+. Age does not meet the limit.` }, 400);
    }

    const tierIds = items.map((i: any) => i.tierId);
    const { data: tiers, error: tErr } = await sb.from("ticket_tiers").select("*").in("id", tierIds).eq("event_id", eventId);
    if (tErr || !tiers?.length) return json({ error: "Invalid tiers" }, 400);

    const now = new Date();
    let total = 0;
    const ticketRows: any[] = [];
    for (const item of items) {
      const tier = tiers.find((t) => t.id === item.tierId);
      if (!tier) return json({ error: "Tier not found" }, 400);
      if (tier.sales_start_at && new Date(tier.sales_start_at) > now) return json({ error: `${tier.name} sales haven't started` }, 400);
      if (tier.sales_end_at && new Date(tier.sales_end_at) < now) return json({ error: `${tier.name} sales have ended` }, 400);
      const qty = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      const { data: soldRes } = await sb.rpc("tier_sold_count", { _tier_id: tier.id });
      const sold = Number(soldRes || 0);
      if (sold + qty > tier.capacity) return json({ error: `Only ${tier.capacity - sold} left of ${tier.name}` }, 400);
      total += tier.price_ugx * qty;
      for (let n = 0; n < qty; n++) ticketRows.push({ tier_id: tier.id, holder_name: item.holderName || buyer.name });
    }

    if (total <= 0) return json({ error: "Order total is zero" }, 400);

    // Prevent duplicate TID reuse for the same event
    const { data: dup } = await sb.from("orders").select("id").eq("event_id", eventId).eq("manual_tid", String(tid).trim()).maybeSingle();
    if (dup) return json({ error: "That Transaction ID has already been submitted." }, 400);

    const merchantRef = `MANUAL-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: order, error: oErr } = await sb.from("orders").insert({
      event_id: eventId,
      buyer_name: buyer.name,
      buyer_email: buyer.email.toLowerCase(),
      buyer_phone: buyer.phone,
      amount_ugx: total,
      pesapal_merchant_reference: merchantRef,
      payment_method: "manual",
      manual_provider: provider,
      manual_tid: String(tid).trim(),
      status: "pending",
    }).select().single();
    if (oErr || !order) throw new Error(`Order insert failed: ${oErr?.message}`);

    const withOrder = ticketRows.map((r) => ({ ...r, order_id: order.id }));
    const { error: tInsErr } = await sb.from("tickets").insert(withOrder);
    if (tInsErr) throw new Error(`Ticket insert failed: ${tInsErr.message}`);

    return json({ ok: true, merchant_reference: merchantRef });
  } catch (e) {
    console.error("manual-checkout error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
