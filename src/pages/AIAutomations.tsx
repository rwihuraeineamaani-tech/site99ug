import { motion } from "framer-motion";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { WipeLink } from "@/components/ThemeWipe";
import Seo from "@/components/Seo";
import { AuditTool } from "@/components/ai/AuditTool";
import { ParticleField } from "@/components/ai/ParticleField";
import { PoweredByLockup } from "@/components/ai/PoweredByLockup";
import { ProductCarousel } from "@/components/ai/ProductCarousel";
import { CapabilityScroll } from "@/components/ai/CapabilityScroll";
import { SystemLedger } from "@/components/ai/SystemLedger";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const positioning = [
  "Built to plug into what you already run.",
  "No rip-and-replace. No learning curve.",
  "Backed by Site 99's track record in custom digital systems.",
  "Shipped by the same hands that maintain it.",
];

export default function AIAutomations() {
  const [form, setForm] = useState({ name: "", company: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.from("ai_leads").insert({ ...form });
      if (error) throw error;
      supabase.functions
        .invoke("send-ai-lead-notification", { body: { ...form } })
        .catch(() => {});
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Could not send. Email us at info@site99ug.com");
    } finally {
      setSending(false);
    }
  };

  const field =
    "w-full rounded-none border border-white/15 bg-black px-4 py-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white transition-colors";

  return (
    <div className="ai-theme grain min-h-screen bg-black text-white">
      <Seo
        title="AI & Automations — Site 99"
        description="Site 99's AI & Automation sector. Intelligent systems that make businesses run smarter — starting with Kazi Intelligent Systems. Run a free automation audit."
        path="/ai-automations"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "AI & Automations",
            provider: { "@type": "Organization", name: "Site 99", url: "https://site99ug.com" },
            areaServed: "UG",
            serviceType: "AI systems and business process automation",
            url: "https://site99ug.com/ai-automations",
          })}
        </script>
      </Helmet>
      <WipeLink
        to="/"
        className="fixed left-8 top-8 z-50 tech text-[11px] uppercase tracking-[0.28em] text-white/45 hover:text-white transition-colors md:left-16"
      >
        ← Site 99
      </WipeLink>

      <main>
        {/* HERO */}
        <section className="relative min-h-[100svh] overflow-hidden px-4 sm:px-8 md:px-16 pt-24 pb-10 md:pt-28">
          <div className="absolute inset-0">
            <ParticleField />
            <div className="ai-grid absolute inset-0 opacity-[0.18]" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="ai-scan absolute inset-x-0 top-0 h-[2px] bg-white/25 blur-[2px]" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(75vw_60vw_at_65%_8%,hsl(0_0%_100%/0.07),transparent_70%)]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-auto flex min-h-[calc(100svh-8.5rem)] w-full max-w-5xl flex-col justify-between gap-10 border border-white/12 p-5 sm:p-8 md:p-12"
          >
            {/* top */}
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-white" />
                <span className="tech text-[10px] font-bold uppercase tracking-[0.4em] text-white">Site 99 Sector</span>
              </div>
              <h1 className="display mt-4 text-[clamp(2.6rem,11vw,7rem)] font-black leading-[0.92] tracking-tight">
                AI &amp;
                <br />
                Automations
              </h1>
            </div>

            {/* ledger */}
            <div className="md:max-w-lg">
              <SystemLedger />
            </div>

            {/* bottom */}
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <p className="text-fluid-md text-white/75 md:max-w-sm">
                Kazi means work. Systems that make it lighter.
              </p>
              <a
                href="#audit"
                className="group flex flex-col items-start gap-3 md:items-center"
              >
                <span className="tech text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 transition-colors group-hover:text-white">
                  Scroll to audit
                </span>
                <span className="relative block h-12 w-px overflow-hidden bg-white/25">
                  <motion.span
                    className="absolute inset-x-0 h-1/2 bg-white"
                    animate={{ y: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </span>
              </a>
            </div>
          </motion.div>
        </section>


        {/* AUDIT TOOL */}
        <section className="relative px-8 md:px-16 py-24 md:py-36 border-t border-white/10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-3xl md:text-5xl">Automation audit</h2>
            <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/40">3 questions · no signup</span>
          </div>
          <AuditTool />
        </section>

        {/* PRODUCTS */}
        <section className="relative px-8 md:px-16 py-20 md:py-28 border-t border-white/10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">Products in the sector</h2>
            <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/25 hidden sm:inline">Swipe →</span>
          </div>
          <ProductCarousel />
        </section>

        {/* CAPABILITIES */}
        <section className="relative px-8 md:px-16 py-20 md:py-28 border-t border-white/10">
          <div className="mb-8">
            <h2 className="display text-3xl md:text-5xl">What we can build</h2>
            <p className="tech mt-3 text-[11px] uppercase tracking-[0.24em] text-white/40">
              Custom systems, shipped fast
            </p>
          </div>
          <CapabilityScroll />
          <p className="mt-8 text-sm text-white/50">
            Not on the list?{" "}
            <a href="#demo" className="text-white underline underline-offset-4">
              We build custom.
            </a>
          </p>
        </section>



        {/* POSITIONING */}
        <section className="px-8 md:px-16 py-24 md:py-36 border-t border-white/10">
          <div className="grid gap-6 md:grid-cols-2">
            {positioning.map((line, i) => (
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="display text-2xl md:text-4xl leading-tight"
              >
                <span className="tech mr-4 align-middle text-[11px] tracking-[0.24em] text-white/50">0{i + 1}</span>
                {line}
              </motion.p>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section className="px-8 md:px-16 py-20 md:py-28 border-t border-white/10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-xl rounded-none border border-white/15 bg-black p-6"
          >
            <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Who builds it</span>
            <p className="mt-3 font-semibold">Rwihura Eineammani — Lead Engineer</p>
            <p className="mt-2 text-sm text-white/60">
              Undertaking a Bachelor's degree in Engineering, Robotics and Artificial Intelligence.
            </p>
          </motion.div>
        </section>

        {/* DEMO / CONTACT */}
        <section id="demo" className="px-8 md:px-16 py-24 md:py-36 border-t border-white/10 scroll-mt-24">
          <p className="display text-center text-3xl md:text-6xl italic text-white/90">_work made easier_</p>
          <p className="mt-4 mb-16 text-center tech text-[11px] uppercase tracking-[0.28em] text-white/40">
            contact us now to get a DEMO
          </p>
          <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <h2 className="display text-3xl md:text-5xl">Request a demo</h2>
              <p className="mt-4 text-white/60 max-w-md">Tell us what you'd like to automate. We'll come back with a build path.</p>

              <p className="mt-6 text-sm text-white/50">
                or email us directly at{" "}
                <a href="mailto:info@site99ug.com" className="text-white underline underline-offset-4 hover:text-white/70 transition-colors">
                  info@site99ug.com
                </a>
              </p>
            </div>

            {sent ? (
              <div className="rounded-none border border-white/25 bg-black p-8">
                <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/50">Received</span>
                <p className="mt-3 text-xl font-semibold">We'll be in touch shortly.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-none border border-white/15 bg-black p-6 md:p-8 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ai-name" className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Name</label>
                    <input id="ai-name" required value={form.name} onChange={update("name")} className={`mt-2 ${field}`} placeholder="Your name" />
                  </div>
                  <div>
                    <label htmlFor="ai-company" className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Company</label>
                    <input id="ai-company" value={form.company} onChange={update("company")} className={`mt-2 ${field}`} placeholder="Business name" />
                  </div>
                </div>
                <div>
                  <label htmlFor="ai-email" className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Email</label>
                  <input id="ai-email" type="email" required value={form.email} onChange={update("email")} className={`mt-2 ${field}`} placeholder="you@company.com" />
                </div>
                <div>
                  <label htmlFor="ai-message" className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">What would you like to automate?</label>
                  <textarea id="ai-message" rows={4} value={form.message} onChange={update("message")} className={`mt-2 ${field} resize-none`} placeholder="Short description" />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black hover:bg-white/85 transition-colors disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Request a Demo"}
                </button>
              </form>
            )}
          </div>
        </section>

        <footer className="px-8 md:px-16 py-20 border-t border-white/10 flex flex-col items-center gap-6">
          <PoweredByLockup className="h-24 md:h-28" />
          <p className="tech text-[11px] uppercase tracking-[0.24em] text-white/35">© Site 99 UG LTD</p>
        </footer>

      </main>
    </div>
  );
}
