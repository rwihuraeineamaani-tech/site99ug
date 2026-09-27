import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ROLES = [
  "team_member",
  "founder",
  "creative_director",
  "managing_director",
  "sales_head",
  "finance_ops",
  "creative",
  "strategist",
  "legal",
  "admin",
  "event_manager",
  "scanner",
  "viewer",
  "site_editor",
  "operations_manager",
  "talent",
  "talent_director",
  "client_relations",
  "communications",
  "hr",
  "designer",
  "client",
] as const;
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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Client portal logins: Client Relations, leadership and the client's Handler may create or reset them.
    if (action === "client_login_create" || action === "client_login_reset") {
      const residentId = String(body.resident_id ?? "");
      if (!residentId) return json({ error: "Pick the client" });
      const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
      const cr = (callerRoles ?? []).map((r) => r.role as string);
      const { data: res } = await admin.from("residents").select("id, handler_user_id, contact_user_id").eq("id", residentId).maybeSingle();
      if (!res) return json({ error: "Client not found" });
      const allowed =
        cr.some((r) => ["admin", "founder", "managing_director", "operations_manager", "client_relations", "communications", "sales_head"].includes(r)) ||
        res.handler_user_id === callerId || res.contact_user_id === callerId;
      if (!allowed) return json({ error: "Only Client Relations, leadership or this client's Handler can manage portal logins" });
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" });
      const friendly = (m?: string) =>
        /weak|known to be|easy to guess|pwned|breach/i.test(m ?? "")
          ? "That password is too easy to guess. Use the suggest button for a strong one."
          : m ?? "Could not save the login";

      if (action === "client_login_reset") {
        const userId = String(body.user_id ?? "");
        const { data: link } = await admin.from("resident_users").select("id").eq("resident_id", residentId).eq("user_id", userId).maybeSingle();
        if (!link) return json({ error: "That login doesn't belong to this client" });
        const { data: tr } = await admin.from("user_roles").select("role").eq("user_id", userId);
        if ((tr ?? []).some((r) => r.role !== "client")) return json({ error: "That is a staff account — reset it from System Admin" });
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) return json({ error: friendly(error.message) });
        return json({ ok: true });
      }

      const email = String(body.email ?? "").trim().toLowerCase();
      const displayName = String(body.display_name ?? "").trim() || null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Valid email required" });
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name: displayName },
      });
      let uid = created?.user?.id ?? "";
      let reused = false;
      if (createErr || !uid) {
        if (!/already/i.test(createErr?.message ?? "")) return json({ error: friendly(createErr?.message) });
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
        if (!existing) return json({ error: "That email is already registered elsewhere." });
        const { data: tr } = await admin.from("user_roles").select("role").eq("user_id", existing.id);
        if ((tr ?? []).some((r) => r.role !== "client")) return json({ error: "That email belongs to a staff account. Use a different email." });
        uid = existing.id;
        reused = true;
        const { error: updErr } = await admin.auth.admin.updateUserById(uid, { password, email_confirm: true });
        if (updErr) return json({ error: friendly(updErr.message) });
      }
      await admin.from("team_members").upsert({ user_id: uid, email, display_name: displayName, created_by: callerId }, { onConflict: "user_id" });
      await admin.from("user_roles").upsert([{ user_id: uid, role: "client" }], { onConflict: "user_id,role" });
      const { error: linkErr } = await admin.from("resident_users").upsert(
        { resident_id: residentId, user_id: uid, email, invited_by: callerId, accepted_at: new Date().toISOString() },
        { onConflict: "email" }
      );
      if (linkErr) return json({ error: linkErr.message });
      await admin.from("activity_log").insert({ actor_id: callerId, actor_kind: "staff", area: "Client Relations", action: "Gave portal access", summary: `Portal login for ${email}`, path: `/app/residents/${residentId}`, entity_type: "resident", entity_id: residentId, detail: {} });
      return json({ ok: true, user_id: uid, reused });
    }

    // Account and role changes are reserved for the explicit System admin role.
    const { data: isSystemAdmin } = await admin.rpc("is_system_admin", { _user_id: callerId });
    if (!isSystemAdmin) return json({ error: "System admin only" }, 403);

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
      const jobTitle = String(body.title ?? "").trim() || null;
      const roles = sanitizeRoles(body.roles);
      if (!roles.includes("client") && !roles.includes("team_member")) roles.unshift("team_member");
      // Failures here return 200 with an `error` field so the browser can read the reason.
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Valid email required" });
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" });
      if (!roles.length) return json({ error: "Pick at least one access level" });

      /** Turn auth-service wording into something a person can act on. */
      const friendly = (msg?: string) => {
        const m = msg ?? "Could not create the account";
        if (/weak|known to be|easy to guess|pwned|breach/i.test(m))
          return "That password is too easy to guess — it appears in known password leaks. Use the suggest button for a strong one.";
        if (/password/i.test(m) && /short|least|length/i.test(m))
          return "That password is too short — use at least 8 characters.";
        return m;
      };

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      let uid = created?.user?.id ?? "";
      let reused = false;

      // The email may already have an account (an old console login, or a resident).
      // Reuse it: set the new password, name and access instead of failing.
      if (createErr || !uid) {
        const alreadyExists = /already/i.test(createErr?.message ?? "");
        if (!alreadyExists) return json({ error: friendly(createErr?.message) });

        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
        if (!existing) return json({ error: "That email is already registered elsewhere." });
        uid = existing.id;
        reused = true;

        const { error: updErr } = await admin.auth.admin.updateUserById(uid, {
          password,
          email_confirm: true,
          user_metadata: { ...(existing.user_metadata ?? {}), display_name: displayName },
        });
        if (updErr) return json({ error: friendly(updErr.message) });
        await admin.from("user_roles").delete().eq("user_id", uid);
      }


      await admin.from("team_members").upsert(
        { user_id: uid, email, display_name: displayName, title: jobTitle, created_by: callerId },
        { onConflict: "user_id" }
      );
      await admin
        .from("user_roles")
        .upsert(roles.map((role) => ({ user_id: uid, role })), { onConflict: "user_id,role" });

      // A client login is tied to exactly one client record.
      if (roles.includes("client")) {
        const residentId = String(body.resident_id ?? "");
        if (!residentId) return json({ error: "Pick the Resident this login belongs to" });
        const { error: linkErr } = await admin
          .from("resident_users")
          .upsert(
            { resident_id: residentId, user_id: uid, email, invited_by: callerId, accepted_at: new Date().toISOString() },
            { onConflict: "email" }
          );
        if (linkErr) return json({ error: linkErr.message });
      }

      return json({ ok: true, user_id: uid, reused });
    }


    if (action === "set_profile") {
      const userId = String(body.user_id ?? "");
      if (!userId) return json({ error: "user_id required" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.display_name !== undefined) patch.display_name = String(body.display_name).trim() || null;
      if (body.title !== undefined) patch.title = String(body.title).trim() || null;
      if (Object.keys(patch).length) {
        const { error } = await admin.from("team_members").update(patch).eq("user_id", userId);
        if (error) return json({ error: error.message }, 400);
      }
      if (patch.display_name !== undefined) {
        await admin.auth.admin.updateUserById(userId, { user_metadata: { display_name: patch.display_name } });
      }
      return json({ ok: true });
    }

    if (action === "set_roles") {
      const userId = String(body.user_id ?? "");
      const roles = sanitizeRoles(body.roles);
      if (!roles.includes("client") && !roles.includes("team_member")) roles.unshift("team_member");
      if (!userId) return json({ error: "user_id required" }, 400);
      const keepsLeadership = roles.some((r) => ["admin", "founder", "managing_director"].includes(r));
      if (userId === callerId && !keepsLeadership)
        return json({ error: "You cannot remove your own leadership access" }, 400);

      const { data: beforeRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
      const beforeRoles = (beforeRows ?? []).map((row) => row.role as Role);
      await admin.from("user_roles").delete().eq("user_id", userId);
      if (roles.length) {
        const { error } = await admin.from("user_roles").insert(roles.map((role) => ({ user_id: userId, role })));
        if (error) throw error;
      }
      await admin.from("access_change_history").insert({ target_user_id: userId, actor_id: callerId, before_roles: beforeRoles, after_roles: roles, reason: "System Administrator updated positions and access" });
      await admin.from("activity_log").insert({ actor_id: callerId, actor_kind: "staff", area: "System administration", action: "Updated access", summary: "Positions and workspace access changed", path: "/app/system-admin", entity_type: "team_member", entity_id: userId, detail: { before_roles: beforeRoles, after_roles: roles } });
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
