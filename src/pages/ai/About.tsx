import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";

const steps = [
  { n: "01", t: "Audit", c: "We sit with the process as it runs today and count the hours it eats. No assumptions, no generic templates." },
  { n: "02", t: "Map", c: "Every step gets drawn — what stays manual, what becomes automated, and what disappears entirely." },
  { n: "03", t: "Build", c: "We ship in phases so something useful lands in weeks, not quarters. Your team tests it while we build the next layer." },
  { n: "04", t: "Maintain", c: "The same hands that built it keep it running, adjust it as you grow, and train the people using it." },
];

const positioning = [
  "Built to plug into what you already run.",
  "No rip-and-replace. No learning curve.",
  "Backed by Site 99's track record in custom digital systems.",
  "Shipped by the same hands that maintain it.",
];

export default function AIAbout() {
  return (
    <>
      <Seo
        title="About the AI & Automation Sector — Site 99"
        description="Site 99's AI & Automation sector: how we audit, map, build and maintain intelligent business systems in Uganda, and who builds them."
        path="/ai-automations/about"
      />

      <section className="px-4 pb-14 pt-20 sm:px-8 md:px-16 md:pt-28">
        <span className="tech text-[10px] uppercase tracking-[0.28em] text-white/45">The sector</span>
        <h1 className="display mt-4 text-[clamp(2.4rem,8vw,5.5rem)] font-black leading-[0.95]">About</h1>
        <p className="mt-6 max-w-2xl text-fluid-md leading-relaxed text-white/70">
          AI &amp; Automations is the arm of Site 99 that builds intelligent systems. Not slide decks about AI — working
          software that removes real hours from real businesses, shipped by the same studio that builds the brands.
        </p>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="display text-2xl md:text-4xl">How we work</h2>
        <div className="mt-10 grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="bg-black p-7"
            >
              <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/35">{s.n}</span>
              <h3 className="display mt-4 text-2xl">{s.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{s.c}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 sm:px-8 md:px-16 md:py-28">
        <div className="grid gap-6 md:grid-cols-2">
          {positioning.map((line, i) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="display text-2xl leading-tight md:text-4xl"
            >
              <span className="tech mr-4 align-middle text-[11px] tracking-[0.24em] text-white/50">0{i + 1}</span>
              {line}
            </motion.p>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">Who builds it</h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-8 max-w-2xl border border-white/15 bg-black p-7 md:p-10"
        >
          <p className="display text-2xl md:text-3xl">Rwihura Eineammani</p>
          <p className="tech mt-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Lead Engineer — AI &amp; Automations</p>
          <p className="mt-6 text-sm leading-relaxed text-white/65">
            Undertaking a Bachelor's degree in Engineering, Robotics and Artificial Intelligence. Leads the design and
            delivery of every system in the sector — from the data model up to the interface the team uses daily.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            Supported by the wider Site 99 studio: strategy, identity, film, code and broadcast under one roof.
          </p>
        </motion.div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 text-center sm:px-8 md:px-16 md:py-28">
        <p className="display text-2xl md:text-4xl">Start with the audit.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/ai-automations"
            className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-white hover:text-black"
          >
            Run the audit
          </Link>
          <Link
            to="/ai-automations/contact"
            className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-white/85"
          >
            Request a demo
          </Link>
        </div>
      </section>
    </>
  );
}
