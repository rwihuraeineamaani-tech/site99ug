import { motion, useScroll, useTransform, useInView, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Marquee } from "@/components/Marquee";
import heroImg from "@/assets/hero-frontier.jpg";

const residents = [
  "Kweli Creatives",
  "Rolex Guy Uganda",
  "Uganda Youth Forum",
  "The Lawns Restaurant",
  "Montana International School",
  "Nehemiah Consultants",
];

const stats = [
  { k: "Residents In Trust", v: 6, suffix: "" },
  { k: "Years Building", v: 6, suffix: "" },
  { k: "Markets Reached", v: 12, suffix: "" },
  { k: "Stories Shipped", v: 240, suffix: "+" },
];

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return controls.stop;
  }, [inView, to, mv]);
  const display = to >= 100 ? String(val) : String(val).padStart(2, "0");
  return <span ref={ref}>{display}{suffix}</span>;
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const manifestoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: mp } = useScroll({ target: manifestoRef, offset: ["start end", "end start"] });

  const words = "We build brands that travel without us. Land will not be more valuable than online attention. We earn that attention with stories worth watching.".split(" ");

  return (
    <Layout>
      {/* HERO — keeps cinematic dark, full-bleed */}
      <section ref={heroRef} className="relative h-[110vh] overflow-hidden bg-site-black text-site-white">
        <motion.div style={{ y: heroY, scale: heroScale }} className="absolute inset-0">
          <img src={heroImg} alt="Site 99 — narrative control" className="w-full h-full object-cover opacity-90" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-site-black/40 via-transparent to-site-black" />
        </motion.div>

        <div className="absolute top-32 left-6 md:left-10 label text-[11px] text-white/80">
          Site 99 — Creative Residency
        </div>
        <div className="absolute top-32 right-6 md:right-10 label text-[11px] text-white/80 text-right flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-site-red rounded-full animate-pulse" /> Residency Open
        </div>

        <motion.div style={{ y: titleY }} className="absolute inset-0 flex flex-col justify-end pb-24 md:pb-32 px-6 md:px-10">
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="display text-fluid-hero"
            >
              Brands that
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              className="display text-fluid-hero"
            >
              travel <span className="text-site-red">without</span> us.
            </motion.h1>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          >
            <p className="max-w-md text-fluid-md text-white/85 font-medium">
              Site 99 is a creative residency. We build entertaining content and brand systems that earn attention — and keep it.
            </p>
            <Link
              to="/access"
              data-hover
              className="group inline-flex items-center gap-4 bg-site-red text-site-white px-7 py-4 rounded-full label text-xs hover:bg-site-white hover:text-site-red transition-colors"
            >
              Request Residency
              <span className="group-hover:translate-x-2 transition-transform">→</span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* MARQUEE — light section */}
      <section className="border-y border-border bg-background py-8 md:py-10">
        <div className="px-6 md:px-10 mb-4 flex items-center justify-between label text-[11px] text-muted-foreground">
          <span>In Residency — Currently with Site 99</span>
          <span className="hidden md:inline">Scroll →</span>
        </div>
        <Marquee items={residents} />
      </section>

      {/* MANIFESTO — light, scroll-scrub words */}
      <section ref={manifestoRef} className="px-6 md:px-10 py-32 md:py-48 max-w-7xl mx-auto">
        <div className="label text-site-red mb-8">Doctrine</div>
        <h2 className="display text-fluid-xl leading-[0.95] flex flex-wrap gap-x-4 gap-y-2">
          {words.map((w, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            const opacity = useTransform(mp, [start * 0.7, end * 0.7], [0.15, 1]);
            return (
              <motion.span key={i} style={{ opacity }} className={w.includes("attention.") || w.includes("us.") ? "text-site-red" : ""}>
                {w}
              </motion.span>
            );
          })}
        </h2>
      </section>

      {/* STATS — dark inset section, animated counters */}
      <section className="section-dark border-t border-b grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.k}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="border-r last:border-r-0 border-border/40 p-8 md:p-12 group hover:bg-site-red transition-colors duration-500"
          >
            <div className="label text-[11px] text-white/60 group-hover:text-white">{s.k}</div>
            <div className="display text-5xl md:text-7xl mt-4 text-white">
              <Counter to={s.v} suffix={s.suffix} />
            </div>
          </motion.div>
        ))}
      </section>

      {/* CTA SLAB — light, calm */}
      <section className="px-6 md:px-10 py-32 md:py-48 text-center bg-background">
        <motion.h3
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="display text-fluid-xl"
        >
          Ready to build a brand <br className="hidden md:block" />that <span className="text-site-red">travels</span>?
        </motion.h3>
        <p className="label text-muted-foreground mt-6">Qualify for residency</p>
        <Link
          to="/access"
          data-hover
          className="mt-10 inline-flex items-center gap-4 bg-site-red text-site-white px-8 py-5 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors"
        >
          Request Access →
        </Link>
      </section>
    </Layout>
  );
}
