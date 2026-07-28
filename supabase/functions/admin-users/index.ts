import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ROLES = ["admin", "event_manager", "scanner", "viewer", "site_editor"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing authorization" }, 401);

    // Validate the caller's JWT
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Caller must be an admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const sanitizeRoles = (input: unknown): Role[] => {
      if (!Array.isArray(input)) return [];
      return [...new Set(input.map(String))].filter((r): r is Role =>
        (ALLOWED_ROLES as readonly string[]).includes(r)
      );
    };

    if (action === "list") {
      const { data: members, error } = await admin
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      const { data: roles } = ids.length
        ? await admin.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      return json({
        ok: true,
        members: (members ?? []).map((m) => ({
          ...m,
          roles: (roles ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role),
        })),
      });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const displayName = String(body.display_name ?? "").trim() || null;
      const roles = sanitizeRoles(body.roles);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Valid email required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!roles.length) return json({ error: "Pick at least one access level" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createErr || !created?.user) return json({ error: createErr?.message ?? "Create failed" }, 400);
      const uid = created.user.id;

      await admin.from("team_members").upsert(
        { user_id: uid, email, display_name: displayName, created_by: callerId },
        { onConflict: "user_id" }
      );
      await admin.from("user_roles").insert(roles.map((role) => ({ user_id: uid, role })));

      return json({ ok: true, user_id: uid });
    }

    if (action === "set_roles") {
      const userId = String(body.user_id ?? "");
      const roles = sanitizeRoles(body.roles);
      if (!userId) return json({ error: "user_id required" }, 400);
      if (userId === callerId && !roles.includes("admin"))
        return json({ error: "You cannot remove your own admin access" }, 400);

      await admin.from("user_roles").delete().eq("user_id", userId);
      if (roles.length) {
        const { error } = await admin.from("user_roles").insert(roles.map((role) => ({ user_id: userId, role })));
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = String(body.user_id ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      if (userId === callerId) return json({ error: "You cannot delete your own account" }, 400);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("team_members").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
