import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDER_DOMAIN = "notify.site99ug.com";
const PUBLIC_SITE = "https://site99ug.com";

type FieldSpec =
  | { type: "text"; key: string; page?: number; x: number; y: number; size?: number; color?: string; maxWidth?: number }
  | { type: "qr"; key?: string; page?: number; x: number; y: number; size: number };

type Template = { pages?: number; fields: FieldSpec[] };

const DEFAULT_TEMPLATE: Template = {
  fields: [
    { type: "text", key: "event_title", x: 40, y: 300, size: 22 },
    { type: "text", key: "tier_name", x: 40, y: 270, size: 14, color: "#c1272d" },
    { type: "text", key: "holder_name", x: 40, y: 235, size: 16 },
    { type: "text", key: "starts_at", x: 40, y: 205, size: 11 },
    { type: "text", key: "venue", x: 40, y: 185, size: 11 },
    { type: "text", key: "order_ref", x: 40, y: 155, size: 9, color: "#666666" },
    { type: "text", key: "ticket_id", x: 40, y: 140, size: 9, color: "#666666" },
    { type: "qr", x: 420, y: 130, size: 170 },
  ],
};

function hexToRgb(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const c = hex.replace("#", "");
  const n = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is an admin (using their user JWT)
    const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userSb.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { orderId } = await req.json();
    if (!orderId) return json({ error: "orderId required" }, 400);

    // Load order + event + tickets
    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id, buyer_name, buyer_email, buyer_phone, amount_ugx, status, pesapal_merchant_reference, event_id")
      .eq("id", orderId)
      .single();
    if (oErr || !order) return json({ error: "Order not found" }, 404);
    if (order.status !== "paid") return json({ error: "Order is not paid yet" }, 400);

    const { data: event } = await sb
      .from("events")
      .select("id, title, venue, starts_at, slug, ticket_template_url, ticket_template_fields, sender_from_name, sender_from_email, organizer_name, organizer_socials")
      .eq("id", order.event_id)
      .single();
    if (!event) return json({ error: "Event not found" }, 404);

    const { data: tickets } = await sb
      .from("tickets")
      .select("id, holder_name, qr_token, tier_id, ticket_tiers(name)")
      .eq("order_id", order.id);
    if (!tickets?.length) return json({ error: "No tickets on order" }, 400);

    // Load template PDF bytes if provided
    let templateBytes: Uint8Array | null = null;
    if (event.ticket_template_url) {
      // ticket_template_url stored as path within bucket "ticket-templates"
      const path = event.ticket_template_url.replace(/^ticket-templates\//, "");
      const { data: dl } = await sb.storage.from("ticket-templates").download(path);
      if (dl) templateBytes = new Uint8Array(await dl.arrayBuffer());
    }

    const spec: Template = (event.ticket_template_fields && (event.ticket_template_fields as any).fields)
      ? (event.ticket_template_fields as unknown as Template)
      : DEFAULT_TEMPLATE;

    const links: { name: string; url: string; holder: string }[] = [];

    for (const t of tickets) {
      const pdfDoc = templateBytes
        ? await PDFDocument.load(templateBytes)
        : await PDFDocument.create();
      if (!templateBytes) pdfDoc.addPage([600, 350]); // A5-ish landscape
      const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const values: Record<string, string> = {
        event_title: event.title,
        venue: event.venue || "",
        starts_at: new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }),
        holder_name: t.holder_name || order.buyer_name,
        tier_name: (t as any).ticket_tiers?.name || "",
        order_ref: `Ref ${order.pesapal_merchant_reference}`,
        ticket_id: `Ticket ${t.id.slice(0, 8).toUpperCase()}`,
        organizer: event.organizer_name || "",
      };

      for (const f of spec.fields) {
        const pageIdx = Math.max(0, (f.page ?? 1) - 1);
        const page = pdfDoc.getPages()[pageIdx] || pdfDoc.getPages()[0];
        if (f.type === "text") {
          const txt = values[f.key] ?? "";
          if (!txt) continue;
          const font = f.key === "event_title" || f.key === "tier_name" ? helv : helvReg;
          page.drawText(String(txt), {
            x: f.x,
            y: f.y,
            size: f.size ?? 12,
            font,
            color: hexToRgb(f.color),
          });
        } else if (f.type === "qr") {
          const dataUrl = await QRCode.toDataURL(`${PUBLIC_SITE}/t/${t.qr_token}`, { margin: 1, width: 512 });
          const png = await pdfDoc.embedPng(dataUrl);
          page.drawImage(png, { x: f.x, y: f.y, width: f.size, height: f.size });
        }
      }

      const bytes = await pdfDoc.save();
      const path = `${order.id}/${t.id}.pdf`;
      const { error: upErr } = await sb.storage
        .from("issued-tickets")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const { data: signed } = await sb.storage
        .from("issued-tickets")
        .createSignedUrl(path, 60 * 60 * 24 * 60); // 60 days
      if (!signed?.signedUrl) throw new Error("Failed to sign URL");

      await sb.from("tickets").update({ pdf_url: path, emailed_at: new Date().toISOString() }).eq("id", t.id);
      links.push({
        name: (t as any).ticket_tiers?.name || "Ticket",
        url: signed.signedUrl,
        holder: t.holder_name || order.buyer_name,
      });
    }

    // Compose email
    const fromName = event.sender_from_name || "Site 99 Tickets";
    const fromEmail = event.sender_from_email || "office@site99ug.com";
    const from = `${fromName} <${fromEmail}>`;
    const subject = `Your ticket${tickets.length > 1 ? "s" : ""} — ${event.title}`;
    const socials = Array.isArray(event.organizer_socials) ? (event.organizer_socials as any[]) : [];

    const whenText = new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
    const html = renderHtml({
      title: event.title,
      whenText,
      venue: event.venue || "",
      buyerName: order.buyer_name,
      links,
      organizerName: event.organizer_name || "",
      socials,
      fromEmail,
    });

    const text = [
      `Your ticket is confirmed — ${event.title}`,
      `${whenText}${event.venue ? " · " + event.venue : ""}`,
      ``,
      `Hi ${order.buyer_name}, thanks for your purchase.`,
      `Your ${links.length > 1 ? links.length + " tickets are" : "ticket is"} available below (PDF). Show the QR at the gate.`,
      ``,
      ...links.map((l, i) => `Ticket ${i + 1} — ${l.name} · ${l.holder}\n${l.url}`),
      ``,
      `Links stay active for 60 days. Save the PDF to your phone before the event.`,
      socials.length ? `\nFollow ${event.organizer_name || "the organizer"}: ${socials.map((s) => `${s.label} ${s.url}`).join(" · ")}` : ``,
      ``,
      `No-reply notice from ${fromEmail}. For help: office@site99ug.com`,
    ].join("\n");

    const messageId = `ticket-${order.id}`;
    const { error: enqErr } = await sb.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: order.buyer_email,
        from,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "ticket-delivery",
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqErr) throw new Error(`Enqueue failed: ${enqErr.message}`);

    await sb.from("orders").update({ tickets_emailed_at: new Date().toISOString() }).eq("id", order.id);

    return json({ ok: true, sent_to: order.buyer_email, count: links.length });
  } catch (e) {
    console.error("send-ticket-email error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderHtml(p: {
  title: string; whenText: string; venue: string; buyerName: string;
  links: { name: string; url: string; holder: string }[];
  organizerName: string; socials: { label: string; url: string }[]; fromEmail: string;
}) {
  const socialsHtml = p.socials.length
    ? `<p style="margin:16px 0 0;color:#666;font-size:12px">Follow ${esc(p.organizerName || "the organizer")}: ${p.socials.map((s) => `<a href="${esc(s.url)}" style="color:#c1272d;text-decoration:none;margin-right:10px">${esc(s.label)}</a>`).join("")}</p>`
    : "";
  const ticketRows = p.links
    .map(
      (l, i) => `
      <tr>
        <td style="padding:14px 0;border-top:1px solid #eee">
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><strong>${esc(l.name)}</strong> · ${esc(l.holder)}</div>
          <a href="${esc(l.url)}" style="display:inline-block;margin-top:8px;background:#c1272d;color:#fff;padding:10px 16px;border-radius:999px;font-family:Arial,sans-serif;font-size:12px;text-decoration:none;letter-spacing:.1em;text-transform:uppercase">Download ticket ${i + 1} (PDF)</a>
        </td>
      </tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#111">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#c1272d">Your ticket is confirmed</div>
      <h1 style="font-size:26px;margin:8px 0 4px">${esc(p.title)}</h1>
      <div style="color:#666;font-size:13px">${esc(p.whenText)}${p.venue ? " · " + esc(p.venue) : ""}</div>
      <p style="font-size:14px;line-height:1.5;margin-top:20px">Hi ${esc(p.buyerName)}, thanks for your purchase. Your ${p.links.length > 1 ? p.links.length + " tickets are" : "ticket is"} attached as a PDF download below. Show the QR at the gate.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${ticketRows}</table>
      <p style="margin:24px 0 0;color:#666;font-size:12px">Links stay active for 60 days. Save the PDF to your phone before the event.</p>
      ${socialsHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
      <p style="color:#999;font-size:11px;line-height:1.5">This is a no-reply notice from ${esc(p.fromEmail)}. For anything ticket-related, contact <a href="mailto:office@site99ug.com" style="color:#c1272d">office@site99ug.com</a>.</p>
    </div>
  </body></html>`;
}
