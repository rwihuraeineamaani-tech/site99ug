import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";

export default function ResidentPortal() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/residents/login", { replace: true });
      else setEmail(data.session.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/residents/login", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/residents/login", { replace: true });
  };

  return (
    <Layout>
      <section className="min-h-screen pt-32 px-6 md:px-10 max-w-3xl mx-auto pb-20">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">Resident Portal</div>
        <h1 className="display text-fluid-hero leading-[0.9]">In residency.</h1>
        <p className="mt-8 text-muted-foreground text-fluid-md">
          Welcome, <span className="text-foreground">{email}</span>. Your dedicated resident dashboard is being prepared — briefs, deliverables and reports will appear here.
        </p>
        <button onClick={signOut} data-hover
          className="mt-12 mono text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">
          Sign out →
        </button>
      </section>
    </Layout>
  );
}
