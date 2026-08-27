import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  LifeBuoy,
  Rocket,
  ScanLine,
  Sparkles,
  Timer,
} from "lucide-react";
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
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-16 pt-28 sm:px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <div className="group flex items-center gap-3">
            <span className="h-px w-8 bg-white transition-all duration-300 group-hover:w-12" />
            <Cpu className="h-3.5 w-3.5 text-white/70 transition-transform duration-500 group-hover:rotate-90 group-hover:text-white" />
            <span className="tech text-[10px] font-bold uppercase tracking-[0.4em] text-white">Site 99 Sector</span>
          </div>

          <h1 className="display mt-6 text-[clamp(2.8rem,10.5vw,9rem)] font-black leading-[0.88] tracking-tight">
            AI &amp;
            <br />
            Automations
          </h1>

          <div className="mt-8 grid gap-10 border-t border-white/12 pt-8 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <p className="text-fluid-md leading-relaxed text-white/75 md:max-w-xl">
              We build the software your business is currently doing by hand. Custom systems, intelligent workflows and
              automations — designed, engineered and maintained by Site 99. Kazi means work. We make it lighter.
            </p>
            <div className="grid grid-cols-3 gap-4 self-end">
              {[
                { k: "Audit", v: "5 min", Icon: Timer },
                { k: "First build", v: "2–6 wks", Icon: Rocket },
                { k: "Support", v: "Ongoing", Icon: LifeBuoy },
              ].map((m) => (
                <div
                  key={m.k}
                  className="group border-l border-white/15 pl-3 transition-colors hover:border-white/60"
                >
                  <m.Icon className="mb-2 h-4 w-4 text-white/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-white" />
                  <p className="display text-lg md:text-2xl">{m.v}</p>
                  <p className="tech mt-1 text-[9px] uppercase tracking-[0.24em] text-white/40">{m.k}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#audit"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-white/85"
            >
              <ScanLine className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              Run the free audit
            </a>
            <Link
              to="/ai-automations/systems"
              className="group inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold transition-colors hover:border-white/60"
            >
              <Boxes className="h-4 w-4 text-white/60 transition-colors group-hover:text-white" />
              See what we build
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
          <div className="ai-scan absolute inset-x-0 top-0 h-[2px] bg-white/20 blur-[2px]" />
        </div>
      </section>

      {/* WHAT WE BUILD */}
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

      {/* COMMAND CENTER */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-28">
        <div className="relative mx-auto w-full max-w-5xl border border-white/12 p-5 sm:p-8 md:p-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-3xl md:text-5xl">Live system floor</h2>
            <span className="tech text-[11px] uppercase tracking-[0.24em] text-white/40">status · realtime</span>
          </div>
          <div className="mt-8 md:max-w-lg">
            <SystemLedger />
          </div>
          <p className="mt-8 text-fluid-md text-white/70">Kazi means work. Systems that make it lighter.</p>
        </div>
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
