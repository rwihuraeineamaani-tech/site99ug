import { motion } from "framer-motion";
import { useState } from "react";
import { Layout } from "@/components/Layout";

export default function Access() {
  const [form, setForm] = useState({ name: "", brand: "", email: "", territory: "", brief: "" });
  const [pulse, setPulse] = useState(0);
  const [sent, setSent] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setPulse((p) => p + 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <Layout hideFooter>
      <section className="relative min-h-screen pt-28 pb-16 px-6 md:px-10 overflow-hidden">
        {/* pulse waves */}
        <motion.div
          key={pulse}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border-2 border-site-red"
        />
        <motion.div
          key={`${pulse}-b`}
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-site-red"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 05 / Access</div>
          <h1 className="display text-fluid-hero leading-[0.85]">
            Claim your <br/><span className="text-site-red">digital attention.</span>
          </h1>
          <p className="mt-8 max-w-xl text-fluid-md text-muted-foreground">
            Sign up and let our full-fledged team of selftaught specialists push your narrative. And not just a hired individual.
          </p>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-20 border border-site-red p-12"
            >
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">Transmission Received</div>
              <h2 className="display text-5xl md:text-7xl">Coordinates locked.</h2>
              <p className="mt-4 text-muted-foreground">Our intake will respond within 72 hours. Don't claim other plots.</p>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="mt-16 space-y-10 max-w-2xl">
              {[
                { k: "name", label: "01 — Operator", type: "text", placeholder: "Your name" },
                { k: "brand", label: "02 — Brand", type: "text", placeholder: "Brand name" },
                { k: "email", label: "03 — Frequency", type: "email", placeholder: "you@brand.co" },
                { k: "territory", label: "04 — Desired Territory", type: "text", placeholder: "What space do you intend to occupy?" },
              ].map((f) => (
                <div key={f.k} className="group">
                  <label className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground group-focus-within:text-site-red transition-colors">
                    {f.label}
                  </label>
                  <input
                    required
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as any)[f.k]}
                    onChange={update(f.k as any) as any}
                    data-hover
                    className="mt-3 w-full bg-transparent border-b-2 border-border focus:border-site-red outline-none py-3 text-2xl md:text-3xl display placeholder:text-muted-foreground/40 transition-colors"
                  />
                </div>
              ))}
              <div className="group">
                <label className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground group-focus-within:text-site-red transition-colors">
                  05 — Brief
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="The narrative you want to control."
                  value={form.brief}
                  onChange={update("brief") as any}
                  data-hover
                  className="mt-3 w-full bg-transparent border-b-2 border-border focus:border-site-red outline-none py-3 text-xl placeholder:text-muted-foreground/40 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                data-hover
                className="group inline-flex items-center gap-4 bg-site-red text-site-white px-10 py-6 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors"
              >
                Join the Residency
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </button>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}
