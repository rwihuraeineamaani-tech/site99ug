import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import loginBgAsset from "@/assets/IMG_5292.jpg.asset.json";

export default function ResidentLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/residents/portal", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/residents/portal` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/residents/portal", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const input = "mt-2 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3 text-lg";
  const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";

  return (
    <Layout hideFooter>
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <img src={loginBgAsset.url} alt="" aria-hidden className="w-full h-full object-cover opacity-20 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-background" />
      </div>
      <section className="min-h-screen pt-32 px-6 md:px-10 max-w-md mx-auto relative">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Resident Portal</div>
        <h1 className="display text-fluid-xl leading-[0.9]">{mode === "signup" ? "Claim your plot." : "Welcome back."}</h1>
        <form onSubmit={submit} className="mt-12 space-y-8">
          <div><label className={lbl}>Email</label>
            <input required type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className={lbl}>Password</label>
            <input required type="password" minLength={6} className={input} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button type="submit" disabled={loading} data-hover
            className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs disabled:opacity-50">
            {loading ? "…" : mode === "signup" ? "Create account →" : "Sign in →"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-8 mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">
          {mode === "signup" ? "Already a resident? Sign in" : "Need an account? Sign up"} →
        </button>
        <Link to="/" className="block mt-6 mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">← Back to site</Link>
      </section>
    </Layout>
  );
}
