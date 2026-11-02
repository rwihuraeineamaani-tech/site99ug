import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";

const NAKI_URL = "https://nakiai.site99ug.com";

const abilities = [
  { t: "Ask anything", c: "Straight answers in plain language, from quick facts to the questions you were shy to ask." },
  { t: "Write with you", c: "Captions, emails, proposals and speeches drafted in seconds, then shaped to your voice." },
  { t: "Plan the week", c: "Turn a messy list into a clear plan, with steps you can actually finish." },
  { t: "Learn faster", c: "Hard topics broken into small, friendly pieces until they click." },
  { t: "Remembers the thread", c: "Your conversations are saved, so you can pick up exactly where you left off." },
  { t: "Built in Kampala", c: "A Kazi product from Site 99, made for how people here really work and talk." },
];

const steps = [
  ["01", "Open Naki", "Visit nakiai.site99ug.com on your phone or laptop."],
  ["02", "Sign in", "Create a free account so your chats stay yours."],
  ["03", "Start talking", "Type the way you speak. Naki takes it from there."],
];

export default function AINaki() {
  return (
    <>
      <Seo
        title="Naki, your AI companion by Kazi | Site 99 AI & Automations"
        description="Naki is the friendly standalone AI from Kazi. Ask, write, plan and learn, with saved conversations."
        path="/ai-automations/naki"
      />

      <section className="px-4 pb-16 pt-20 sm:px-8 md:px-16 md:pt-28">
        <span className="tech text-[10px] uppercase tracking-[0.28em] text-white/45">Product 02 · by Kazi</span>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="display mt-6 text-[clamp(3rem,12vw,8rem)] font-black leading-[0.9]"
        >
          Naki
        </motion.h1>
        <p className="tech mt-4 text-[11px] uppercase tracking-[0.28em] text-[#a98bff]">Your AI companion</p>
        <p className="mt-10 max-w-2xl text-fluid-md leading-relaxed text-white/75">
          Kazi builds the systems that run a business. Naki is the one you talk to. Ask it, write with it, plan with
          it, and come back tomorrow to find the whole conversation waiting.
        </p>
        <a
          href={NAKI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-block rounded-full bg-[#7c4dff] px-8 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Open Naki
        </a>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">What Naki does</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {abilities.map((a) => (
            <div key={a.t} className="border border-white/10 bg-black p-8">
              <h3 className="display text-xl">{a.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{a.c}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
        <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">Three steps in</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([n, t, c]) => (
            <div key={n} className="border border-white/10 p-8">
              <span className="tech text-[10px] tracking-[0.24em] text-[#a98bff]">{n}</span>
              <h3 className="display mt-3 text-xl">{t}</h3>
              <p className="mt-3 text-sm text-white/60">{c}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-20 text-center sm:px-8 md:px-16 md:py-28">
        <p className="display text-3xl italic text-white/90 md:text-6xl">Say hello to Naki.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={NAKI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#7c4dff] px-8 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            Open Naki
          </a>
          <Link to="/ai-automations/kazi" className="rounded-full border border-white/20 px-8 py-4 text-sm text-white/80 hover:border-white/50">
            See Kazi
          </Link>
        </div>
      </section>
    </>
  );
}
