import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { pesapal } from "../_shared/pesapal.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const orderTrackingId =
      url.searchParams.get("OrderTrackingId") || url.searchParams.get("orderTrackingId");
    const merchantRef =
      url.searchParams.get("OrderMerchantReference") ||
      url.searchParams.get("orderMerchantReference");
    if (!orderTrackingId) return json({ status: 200, message: "no tracking id" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const statusRes = await pesapal(
      `/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      "GET"
    );

    // status_code: 1=Completed, 2=Failed, 3=Reversed, 0=Invalid
    let newStatus: "paid" | "failed" | "cancelled" | "pending" = "pending";
    if (statusRes.status_code === 1) newStatus = "paid";
    else if (statusRes.status_code === 2) newStatus = "failed";
    else if (statusRes.status_code === 3) newStatus = "cancelled";

    const { data: order } = await sb
      .from("orders")
      .select("id, status, buyer_email, buyer_name, event_id, pesapal_merchant_reference")
      .eq("pesapal_tracking_id", orderTrackingId)
      .maybeSingle();

    if (!order && merchantRef) {
      await sb.from("orders").update({ pesapal_tracking_id: orderTrackingId }).eq("pesapal_merchant_reference", merchantRef);
    }

    const targetRef = order?.pesapal_merchant_reference || merchantRef;
    if (targetRef && (!order || order.status !== "paid")) {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();
      await sb.from("orders").update(updates).eq("pesapal_merchant_reference", targetRef);

      if (newStatus === "failed" || newStatus === "cancelled") {
        // void the reserved tickets
        const { data: o } = await sb.from("orders").select("id").eq("pesapal_merchant_reference", targetRef).single();
        if (o) await sb.from("tickets").update({ status: "void" }).eq("order_id", o.id);
      }

      if (newStatus === "paid" && order) {
        // Fire confirmation email (best-effort)
        try {
          const { data: tickets } = await sb.from("tickets").select("qr_token").eq("order_id", order.id);
          const origin = url.origin.replace("supabase.co", "supabase.co"); // placeholder; real app URL comes from client
          await sb.functions.invoke("send-transactional-email", {
            body: {
              templateName: "ticket-confirmation",
              recipientEmail: order.buyer_email,
              idempotencyKey: `ticket-${order.id}`,
              templateData: {
                name: order.buyer_name,
                ticketCount: tickets?.length || 0,
                tokens: tickets?.map((t) => t.qr_token) || [],
              },
            },
          });
        } catch (err) {
          console.warn("email invoke failed", err);
        }
      }
    }

    return json({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference: targetRef, status: 200 });
  } catch (e) {
    console.error("ipn error", e);
    return json({ status: 500, error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
