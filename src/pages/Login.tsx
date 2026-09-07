import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { toast } from "sonner";

type Mode = "signin" | "forgot";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Send whoever is already signed in to the right place.
  useEffect(() => {
    let cancelled = false;
    const route = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      await landFor(data.user.id);
    };

    const landFor = async (uid: string) => {
      // Let an invited client claim their link on first sign-in.
      await Promise.resolve(supabase.rpc("accept_client_invite")).catch(() => undefined);
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (rows ?? []).map((r) => String(r.role));
      const from = (location.state as { from?: string } | null)?.from;
      const staff = roles.some((r) =>
        [
          "admin",
          "founder",
          "creative_director",
          "managing_director",
          "sales_head",
          "finance_ops",
          "creative",
          "legal",
          "event_manager",
          "scanner",
          "viewer",
          "site_editor",
        ].includes(r)
      );
      const target = staff ? "/app" : roles.includes("client") ? "/portal" : roles.includes("resident") ? "/residents/portal" : "/";
      if (cancelled) return;
      navigate(from && from !== "/login" && staff ? from : target, { replace: true });
    };

    route();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
        setMode("signin");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Sign in failed");

      await Promise.resolve(supabase.rpc("accept_client_invite")).catch(() => undefined);
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (rows ?? []).map((r) => String(r.role));
      const staff = roles.some((r) =>
        [
          "admin",
          "founder",
          "creative_director",
          "managing_director",
          "sales_head",
          "finance_ops",
          "creative",
          "legal",
          "event_manager",
          "scanner",
          "viewer",
          "site_editor",
        ].includes(r)
      );
      if (staff) navigate("/app", { replace: true });
      else if (roles.includes("client")) navigate("/portal", { replace: true });
      else if (roles.includes("resident")) navigate("/residents/portal", { replace: true });
      else {
        toast.error("This account has no access yet. Ask Site 99 to grant it.");
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink grid lg:grid-cols-2">
      <Seo title="Sign in — Site 99" description="Sign in to the Site 99 operating system." path="/login" />

      <section className="hidden lg:flex flex-col justify-between border-r border-rule p-12">
        <div className="eyebrow text-signal">Site 99 · Operating system</div>
        <div>
          <h2 className="display text-fluid-xl leading-[0.9]">
            One desk <br />
            for the <span className="text-signal">whole studio.</span>
          </h2>
          <p className="mt-6 max-w-md text-ink-soft">
            Clients, contracts, content, money and events — in one place, scoped to what your role is meant to see.
          </p>
        </div>
        <div className="eyebrow text-ink-faint">Kampala · Uganda</div>
      </section>

      <section className="flex items-center px-6 md:px-16 py-16">
        <div className="w-full max-w-sm">
          <div className="eyebrow text-signal mb-4">{mode === "signin" ? "Sign in" : "Reset password"}</div>
          <h1 className="display text-4xl md:text-5xl leading-[0.9] mb-10">
            {mode === "signin" ? "Welcome back." : "Forgot it?"}
          </h1>

          <form onSubmit={submit} className="space-y-8">
            <div>
              <label htmlFor="login-email" className="eyebrow text-ink-faint">
                Email
              </label>
              <input
                id="login-email"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-3 w-full bg-transparent border-b border-rule-strong focus:border-signal outline-none py-3 text-lg"
              />
            </div>

            {mode === "signin" && (
              <div>
                <label htmlFor="login-password" className="eyebrow text-ink-faint">
                  Password
                </label>
                <input
                  id="login-password"
                  required
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-3 w-full bg-transparent border-b border-rule-strong focus:border-signal outline-none py-3 text-lg"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-paper px-8 py-4 rounded-sm eyebrow hover:bg-signal transition-colors disabled:opacity-50 focus-ring"
            >
              {loading ? "…" : mode === "signin" ? "Sign in →" : "Send reset link →"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "forgot" : "signin")}
              className="eyebrow text-ink-faint hover:text-signal transition-colors"
            >
              {mode === "signin" ? "Forgot password?" : "Back to sign in"}
            </button>
          </form>

          <p className="mt-12 text-xs text-ink-soft">
            Accounts are created by Site 99. Clients are invited by email and see only their own engagement.
          </p>
        </div>
      </section>
    </div>
  );
}
