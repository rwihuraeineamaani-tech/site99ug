import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createResponsesCall } from "../_shared/responses.ts";

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, x-lovable-aig-run-id`,
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra, "Content-Type": "application/json" } });

const SYSTEM = `You are a senior social media strategist at Site 99, a creative agency in Kampala, Uganda.
You receive one video's details and performance numbers. Give short, practical recommendations the team can act on for the next videos.
Write in plain English. Use this markdown layout:
## How it did
2-3 sentences, with rough benchmarks for the platform (say they are rough).
## What worked
2-4 bullets.
## What to change next time
3-5 bullets, each a concrete action (hook, length, posting time, caption, format, call to action).
## Next video ideas
2-3 bullets with specific ideas building on this one.
Keep it under 350 words. If numbers are missing, say what to track next time instead of guessing.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Please sign in." }, 401);
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await supa.auth.getUser();
  if (!userData?.user) return json({ error: "Please sign in." }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not set up yet." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const clip = (v: unknown, n = 2000) => String(v ?? "").slice(0, n);
  const metrics = (body.metrics && typeof body.metrics === "object" ? body.metrics : {}) as Record<string, unknown>;
  const metricLines = Object.entries(metrics)
    .slice(0, 20)
    .map(([k, v]) => `- ${clip(k, 40)}: ${clip(v, 60) || "not given"}`)
    .join("\n");

  const prompt = `Video: ${clip(body.title, 200)}
Type: ${clip(body.type, 80) || "—"}
Client: ${clip(body.client, 120) || "—"}
Platforms: ${clip(body.platforms, 200) || "—"}
Posting times: ${clip(body.postedWhen, 300) || "—"}
Brief / notes: ${clip(body.brief, 1500) || "—"}

Numbers:
${metricLines || "- none given"}

Team's view on why it performed: ${clip(body.note, 1500) || "—"}`;

  try {
    const { result, runIdFetch } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [{ role: "user", content: prompt }],
      SYSTEM,
    );
    const text = (await result.text).trim();
    const runId = runIdFetch.getRunId();
    const extra = runId ? { "X-Lovable-AIG-Run-ID": runId } : {};
    if (!text) return json({ error: "No recommendations came back. Please try again later." }, 502, extra);
    return json({ text }, 200, extra);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return new Response(null, { status: 499, headers: cors });
    const status = Number((e as { statusCode?: number })?.statusCode) || 500;
    const msg =
      status === 402
        ? "AI credits have run out. Add more in Settings → Plans & credits."
        : status === 429
          ? "Too many requests right now. Please wait a minute and try again."
          : status === 403
            ? "AI access is blocked for this workspace."
            : "Couldn't get recommendations. Please try again.";
    console.error("content-recommendations", status, (e as Error)?.message);
    return json({ error: msg }, status >= 400 && status < 600 ? status : 500);
  }
});
