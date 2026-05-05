import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Marquee } from "@/components/Marquee";
import heroImg from "@/assets/hero-frontier.jpg";

const residents = ["Kweli Creatives", "The Lawns", "Northstar", "Atlas & Ore", "Vanta House", "Cipher Goods", "Mercury Studio", "Field Notes"];
const stats = [
  { k: "Residents", v: "08" },
  { k: "Years on Site", v: "06" },
  { k: "Markets", v: "12" },
  { k: "Retainer Hrs / mo", v: "1.2K" },
];

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const manifestoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: mp } = useScroll({ target: manifestoRef, offset: ["start end", "end start"] });

  const words = "We don't make ads. We secure territory. Brand by brand. Frame by frame. Until the narrative is no longer up for debate.".split(" ");

  return (
    <Layout>
      {/* HERO */}
      <section ref={heroRef} className="relative h-[110vh] overflow-hidden">
        <motion.div style={{ y: heroY, scale: heroScale }} className="absolute inset-0">
          <img src={heroImg} alt="The frontier" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-site-black/40 via-transparent to-site-black" />
        </motion.div>

        <div className="absolute top-28 left-6 md:left-10 mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-site-white/70 flex flex-col gap-1">
          <span>N° 099 / FRONTIER LOG</span>
          <span>BROADCAST 24:00 GMT</span>
        </div>
        <div className="absolute top-28 right-6 md:right-10 mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-site-white/70 text-right flex flex-col gap-1">
          <span className="flex items-center justify-end gap-2"><span className="w-1.5 h-1.5 bg-site-red rounded-full animate-pulse" /> LIVE</span>
          <span>RESIDENCY OPEN</span>
        </div>

        <motion.div style={{ y: titleY }} className="absolute inset-0 flex flex-col justify-end pb-24 md:pb-32 px-6 md:px-10">
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="display text-fluid-hero text-site-white"
            >
              The Land
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              className="display text-fluid-hero text-site-white"
            >
              Grab <span className="text-site-red">Is</span> On.
            </motion.h1>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          >
            <p className="max-w-md text-fluid-md text-site-white/80">
              SITE 99 is a creative residency for brands that refuse to be background noise. We don't pitch. We occupy.
            </p>
            <Link
              to="/access"
              data-hover
              className="group inline-flex items-center gap-4 bg-site-red text-site-white px-7 py-4 mono text-xs uppercase tracking-[0.3em] hover:bg-site-white hover:text-site-red transition-colors"
            >
              Claim a Plot
              <span className="group-hover:translate-x-2 transition-transform">→</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-border bg-site-black py-8 md:py-10">
        <div className="px-6 md:px-10 mb-4 flex items-center justify-between mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span>// In Residency — Currently Occupying Site 99 Territory</span>
          <span className="hidden md:inline">⟶ Scroll</span>
        </div>
        <Marquee items={residents} />
      </section>

      {/* MANIFESTO — scroll-scrub words */}
      <section ref={manifestoRef} className="px-6 md:px-10 py-32 md:py-48 max-w-7xl mx-auto">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-8">N° 02 — Doctrine</div>
        <h2 className="display text-fluid-xl leading-none flex flex-wrap gap-x-4 gap-y-2">
          {words.map((w, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            const opacity = useTransform(mp, [start * 0.7, end * 0.7], [0.15, 1]);
            return (
              <motion.span key={i} style={{ opacity }} className={w.includes("territory") || w.includes("debate.") ? "text-site-red" : ""}>
                {w}
              </motion.span>
            );
          })}
        </h2>
      </section>

      {/* STATS */}
      <section className="border-t border-border grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.k}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="border-r last:border-r-0 border-border p-8 md:p-12 group hover:bg-site-red transition-colors duration-500"
          >
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground group-hover:text-site-white">{s.k}</div>
            <div className="display text-5xl md:text-7xl mt-4 group-hover:text-site-white">{s.v}</div>
          </motion.div>
        ))}
      </section>

      {/* CTA SLAB */}
      <section className="px-6 md:px-10 py-32 md:py-48 text-center">
        <motion.h3
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="display text-fluid-xl"
        >
          Plot <span className="text-site-red glitch inline-block">99</span> is the last one.
        </motion.h3>
        <p className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-6">— qualify for residency —</p>
        <Link
          to="/access"
          data-hover
          className="mt-10 inline-flex items-center gap-4 bg-site-red text-site-white px-8 py-5 mono text-xs uppercase tracking-[0.3em] hover:bg-site-white hover:text-site-red transition-colors"
        >
          Request Access →
        </Link>
      </section>
    </Layout>
  );
}
