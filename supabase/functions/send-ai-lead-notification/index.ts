import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

const SENDER = "Site 99 <notifications@notify.site99ug.com>";
const RECIPIENT = "info@site99ug.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name, company, email, message } = await req.json();
    if (!name || !email) {
      return json({ error: "name and email are required" }, 400);
    }

    const safe = (v: unknown) => String(v ?? "").slice(0, 2000);
    const text = [
      "New AI & Automations demo request",
      "",
      `Name: ${safe(name)}`,
      `Company: ${safe(company) || "—"}`,
      `Email: ${safe(email)}`,
      "",
      "What they want to automate:",
      safe(message) || "—",
    ].join("\n");

    await sendLovableEmail({
      from: SENDER,
      to: [RECIPIENT],
      replyTo: safe(email),
      subject: `AI demo request — ${safe(name)}${company ? ` (${safe(company)})` : ""}`,
      text,
      html: `<h2>New AI &amp; Automations demo request</h2>
<p><strong>Name:</strong> ${escapeHtml(safe(name))}<br/>
<strong>Company:</strong> ${escapeHtml(safe(company)) || "—"}<br/>
<strong>Email:</strong> ${escapeHtml(safe(email))}</p>
<p><strong>What they want to automate:</strong><br/>${escapeHtml(safe(message)) || "—"}</p>`,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("send-ai-lead-notification failed", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
