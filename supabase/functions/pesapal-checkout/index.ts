import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { pesapal, getOrRegisterIpn } from "../_shared/pesapal.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const {
      eventId,
      items, // [{ tierId, quantity, holderName? }]
      buyer, // { name, email, phone }
      returnUrl,
      ipnUrl,
    } = await req.json();

    if (!eventId || !Array.isArray(items) || !items.length || !buyer?.email || !buyer?.phone || !buyer?.name) {
      return json({ error: "Missing required fields" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load event + tiers
    const { data: event, error: eErr } = await sb.from("events").select("id,title,published").eq("id", eventId).single();
    if (eErr || !event || !event.published) return json({ error: "Event unavailable" }, 404);

    const tierIds = items.map((i: any) => i.tierId);
    const { data: tiers, error: tErr } = await sb.from("ticket_tiers").select("*").in("id", tierIds).eq("event_id", eventId);
    if (tErr || !tiers?.length) return json({ error: "Invalid tiers" }, 400);

    let total = 0;
    const ticketRows: any[] = [];
    for (const item of items) {
      const tier = tiers.find((t) => t.id === item.tierId);
      if (!tier) return json({ error: "Tier not found" }, 400);
      const qty = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      // capacity check
      const { data: soldRes } = await sb.rpc("tier_sold_count", { _tier_id: tier.id });
      const sold = Number(soldRes || 0);
      if (sold + qty > tier.capacity) return json({ error: `Only ${tier.capacity - sold} left of ${tier.name}` }, 400);
      total += tier.price_ugx * qty;
      for (let n = 0; n < qty; n++) {
        ticketRows.push({ tier_id: tier.id, holder_name: item.holderName || buyer.name });
      }
    }

    if (total <= 0) return json({ error: "Order total is zero" }, 400);

    const merchantRef = `SITE99-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        event_id: eventId,
        buyer_name: buyer.name,
        buyer_email: buyer.email.toLowerCase(),
        buyer_phone: buyer.phone,
        amount_ugx: total,
        pesapal_merchant_reference: merchantRef,
      })
      .select()
      .single();
    if (oErr || !order) throw new Error(`Order insert failed: ${oErr?.message}`);

    const withOrder = ticketRows.map((r) => ({ ...r, order_id: order.id }));
    const { error: tInsErr } = await sb.from("tickets").insert(withOrder);
    if (tInsErr) throw new Error(`Ticket insert failed: ${tInsErr.message}`);

    const notificationUrl = ipnUrl || `${SUPABASE_URL}/functions/v1/pesapal-ipn`;
    const notification_id = await getOrRegisterIpn(notificationUrl);

    const submit = await pesapal("/api/Transactions/SubmitOrderRequest", "POST", {
      id: merchantRef,
      currency: "UGX",
      amount: total,
      description: `${event.title} — ${withOrder.length} ticket(s)`,
      callback_url: returnUrl,
      notification_id,
      billing_address: {
        email_address: buyer.email,
        phone_number: buyer.phone,
        first_name: buyer.name.split(" ")[0] || buyer.name,
        last_name: buyer.name.split(" ").slice(1).join(" ") || "-",
      },
    });

    await sb.from("orders").update({ pesapal_tracking_id: submit.order_tracking_id }).eq("id", order.id);

    return json({ redirect_url: submit.redirect_url, merchant_reference: merchantRef });
  } catch (e) {
    console.error("checkout error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
