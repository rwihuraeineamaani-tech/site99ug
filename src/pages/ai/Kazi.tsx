import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { PoweredByLockup } from "@/components/ai/PoweredByLockup";
import kaziMark from "@/assets/kazi-mark.png.asset.json";

const Star = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" aria-hidden className={className}>
    <path
      d="M50 0 C54 32 68 46 100 50 C68 54 54 68 50 100 C46 68 32 54 0 50 C32 46 46 32 50 0 Z"
      fill="currentColor"
    />
  </svg>
);

const capabilities = [
  { t: "Workflow intelligence", c: "Kazi learns how your work actually moves and removes the repeat steps." },
  { t: "Document understanding", c: "Reads forms, invoices and reports, then files the data where it belongs." },
  { t: "Assisted decisions", c: "Surfaces what needs attention first instead of another full inbox." },
  { t: "Always-on assistants", c: "Answers staff and customer questions from your own knowledge base." },
  { t: "Connected to your stack", c: "Plugs into the systems you already run — no rip-and-replace." },
  { t: "Human at the core", c: "Automation handles the load; your people keep the creativity." },
];

export default function AIKazi() {
  return (
    <>
      <Seo
        title="Kazi Intelligent Systems — Site 99 AI & Automations"
        description="Kazi means work. Kazi Intelligent Systems is Site 99's first AI product — intelligent workflow systems that make everyday work faster and easier."
        path="/ai-automations/kazi"
      />

      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-8 md:px-16 md:pt-28">
        <Star className="pointer-events-none absolute -right-24 -top-20 h-[34rem] w-[34rem] text-[#7c4dff]/[0.07]" />
        <div className="relative">
          <span className="tech text-[10px] uppercase tracking-[0.28em] text-white/45">Product 01 · in the sector</span>
          <motion.img
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            src={kaziMark.url}
            alt="Kazi Intelligent Systems"
            className="mt-8 h-16 w-auto md:h-28"
          />
          <h1 className="sr-only">Kazi Intelligent Systems</h1>
          <p className="tech mt-4 text-[11px] uppercase tracking-[0.28em] text-[#a98bff]">Intelligent Systems</p>

          <p className="mt-10 max-w-2xl text-fluid-md leading-relaxed text-white/75">
            Kazi means work. It stands for the systems that make everyday work faster and easier, for everyone, and
            everything. We make your company more intelligent, while keeping the human creativity at its core.
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/45">
            Developed under the AI &amp; Automation sector of Site 99 UG LTD — intelligent workflow systems powered by
            machine learning and AI.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">What Kazi does</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((c, i) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
              className="border border-white/12 bg-black p-6 transition-colors hover:border-[#7c4dff]/60"
            >
              <span className="block h-2 w-2 rounded-full bg-[#7c4dff]" />
              <h3 className="mt-5 text-lg font-semibold">{c.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{c.c}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 text-center sm:px-8 md:px-16 md:py-28">
        <p className="display text-3xl italic text-white/90 md:text-6xl">_work made easier_</p>
        <p className="tech mt-4 text-[11px] uppercase tracking-[0.28em] text-white/40">contact us now to get a DEMO</p>
        <Link
          to="/ai-automations/contact"
          className="mt-10 inline-block rounded-full bg-[#7c4dff] px-8 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Get a Kazi demo
        </Link>
        <div className="mt-16 flex justify-center">
          <PoweredByLockup className="h-20 md:h-24" />
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">Next in the sector</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Product 02", "Product 03", "Product 04"].map((p) => (
            <div key={p} className="border border-dashed border-white/12 bg-black p-8">
              <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/30">{p}</span>
              <p className="mt-4 text-white/45">In development</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
