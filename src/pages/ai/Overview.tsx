import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { AuditTool } from "@/components/ai/AuditTool";
import { SystemLedger } from "@/components/ai/SystemLedger";
import { CapabilityScroll } from "@/components/ai/CapabilityScroll";
import kaziMark from "@/assets/kazi-mark.png.asset.json";

export default function AIOverview() {
  return (
    <>
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

      {/* HERO */}
      <section className="relative min-h-[100svh] overflow-hidden px-4 pb-10 pt-10 sm:px-8 md:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="ai-scan absolute inset-x-0 top-0 h-[2px] bg-white/25 blur-[2px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto flex min-h-[calc(100svh-6.5rem)] w-full max-w-5xl flex-col justify-between gap-10 border border-white/12 p-5 sm:p-8 md:p-12"
        >
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

          <div className="md:max-w-lg">
            <SystemLedger />
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="text-fluid-md text-white/75 md:max-w-sm">Kazi means work. Systems that make it lighter.</p>
            <a href="#audit" className="group flex flex-col items-start gap-3 md:items-center">
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

      {/* AUDIT */}
      <section id="audit" className="relative scroll-mt-20 border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-32">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-3xl md:text-5xl">Automation audit</h2>
          <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/40">5 questions · no signup</span>
        </div>
        <AuditTool />
      </section>

      {/* SECTOR MAP */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-28">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">Inside the sector</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              to: "/ai-automations/systems",
              index: "01",
              title: "Systems",
              copy: "The full catalogue of what we build — school, inventory, ticketing, CRM, portals, dashboards.",
            },
            {
              to: "/ai-automations/kazi",
              index: "02",
              title: "Kazi Intelligent Systems",
              copy: "Our first product in the sector. Workflow intelligence for everyday work.",
            },
            {
              to: "/ai-automations/about",
              index: "03",
              title: "About the sector",
              copy: "How we work: audit, map, build, maintain. And who builds it.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
            >
              <Link
                to={c.to}
                className="group flex h-full flex-col justify-between gap-8 border border-white/15 bg-black p-6 transition-colors hover:border-white/50 md:p-8"
              >
                <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">{c.index}</span>
                <div>
                  <p className="display text-2xl md:text-3xl">{c.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">{c.copy}</p>
                  <span className="tech mt-6 inline-block text-[10px] uppercase tracking-[0.24em] text-white/45 transition-colors group-hover:text-white">
                    Enter →
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CAPABILITY TEASER */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-28">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-3xl md:text-5xl">What we can build</h2>
          <Link
            to="/ai-automations/systems"
            className="tech text-[10px] uppercase tracking-[0.24em] text-white/50 underline underline-offset-4 hover:text-white"
          >
            See all systems →
          </Link>
        </div>
        <CapabilityScroll />
      </section>

      {/* KAZI TEASER */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-28">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Product 01</span>
            <img src={kaziMark.url} alt="Kazi Intelligent Systems" loading="lazy" className="mt-5 h-9 w-auto md:h-11" />
            <p className="mt-5 max-w-xl leading-relaxed text-white/70">
              Kazi means work. It stands for the systems that make everyday work faster and easier — for everyone, and
              everything.
            </p>
          </div>
          <Link
            to="/ai-automations/kazi"
            className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-white hover:text-black"
          >
            Explore Kazi
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="scroll-mt-24 border-t border-white/10 px-4 py-24 text-center sm:px-8 md:px-16 md:py-36">
        <p className="display text-3xl italic text-white/90 md:text-6xl">_work made easier_</p>
        <p className="tech mt-4 text-[11px] uppercase tracking-[0.28em] text-white/40">
          contact us now to get a DEMO
        </p>
        <Link
          to="/ai-automations/contact"
          className="mt-10 inline-block rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition-colors hover:bg-white/85"
        >
          Request a demo
        </Link>
      </section>
    </>
  );
}
