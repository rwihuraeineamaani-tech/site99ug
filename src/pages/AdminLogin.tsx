import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/admin", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/admin", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout hideFooter>
      <section className="min-h-screen pt-32 pb-16 px-6 md:px-10 flex items-center">
        <div className="max-w-md w-full mx-auto">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Admin Console</div>
          <h1 className="display text-fluid-hero leading-[0.85] mb-10">
            {mode === "signin" ? "Sign in." : "Create account."}
          </h1>
          <form onSubmit={submit} className="space-y-8">
            <div>
              <label className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Email</label>
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-3 w-full bg-transparent border-b-2 border-border focus:border-site-red outline-none py-3 text-2xl display"
              />
            </div>
            <div>
              <label className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Password</label>
              <input
                required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-3 w-full bg-transparent border-b-2 border-border focus:border-site-red outline-none py-3 text-2xl display"
              />
            </div>
            <button type="submit" disabled={loading} data-hover
              className="bg-site-red text-site-white px-10 py-5 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors disabled:opacity-50">
              {loading ? "…" : mode === "signin" ? "Sign in →" : "Create account →"}
            </button>
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="block mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red transition">
              {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
