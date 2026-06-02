import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, animate, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Marquee } from "@/components/Marquee";
import { useProjects } from "@/hooks/useProjects";
import { usePublicResidents } from "@/hooks/useResidents";
import heroAsset from "@/assets/IMG_5291.jpg.asset.json";
import studioAsset from "@/assets/IMG_5289.jpg.asset.json";
import ctaAsset from "@/assets/IMG_5290.jpg.asset.json";
import p1 from "@/assets/project-1.jpg";
import p2 from "@/assets/project-2.jpg";
import p3 from "@/assets/project-3.jpg";
import p4 from "@/assets/project-4.jpg";
const heroImg = heroAsset.url;

const seedMap: Record<string, string> = {
  "/seed/project-1.jpg": p1,
  "/seed/project-2.jpg": p2,
  "/seed/project-3.jpg": p3,
  "/seed/project-4.jpg": p4,
};
const resolveCover = (url: string) => seedMap[url] || url;

const residentsFallback = [
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
  { k: "People Reached", v: 7.2, suffix: "M" },
  { k: "Stories Shipped", v: 240, suffix: "+" },
];

const glimpseFallback = [
  { title: "Black Halo", client: "Kweli Creatives", tag: "Identity / Film", img: p1 },
  { title: "Silhouette Theory", client: "Vanta House", tag: "Campaign", img: p2 },
  { title: "The Rotunda", client: "Atlas & Ore", tag: "Architecture", img: p3 },
  { title: "Fog Dispatch", client: "Mercury Studio", tag: "Editorial Film", img: p4 },
];

const doctrines = [
  { t: "Travel", d: "We build brands that travel without us." },
  { t: "Attention", d: "Online attention will outvalue land. We help you earn it." },
  { t: "Entertain", d: "Entertaining content is the shortest path to trust." },
  { t: "Residency", d: "We stay. We don't pitch and leave." },
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
  const reduce = useReducedMotion();
  const springCfg = { stiffness: 120, damping: 28, mass: 0.4, restDelta: 0.001 };
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const smoothHero = useSpring(scrollYProgress, springCfg);
  const heroY = useTransform(smoothHero, [0, 1], [0, reduce ? 0 : 200]);
  const heroScale = useTransform(smoothHero, [0, 1], [1, reduce ? 1 : 1.15]);
  const titleY = useTransform(smoothHero, [0, 1], [0, reduce ? 0 : -120]);

  const manifestoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: mp } = useScroll({ target: manifestoRef, offset: ["start end", "end start"] });
  const smoothMp = useSpring(mp, springCfg);

  const words = "We build brands that travel without us. Land will not be more valuable than online attention. We earn that attention with stories worth watching.".split(" ");

  const { data: dbProjects = [] } = useProjects();
  const { data: dbResidents = [] } = usePublicResidents();
  const glimpseProjects = dbProjects.length
    ? dbProjects.slice(0, 4).map((p) => ({ title: p.title, client: p.client, tag: p.tag, img: resolveCover(p.cover_url) }))
    : glimpseFallback;
  const visibleResidents = dbResidents.filter((r) => r.visible !== false);
  const residents = visibleResidents.length ? visibleResidents.map((r) => r.name) : residentsFallback;

  return (
    <Layout>
      {/* HERO — black canvas with northern-lights aurora */}
      <section ref={heroRef} className="relative min-h-[110vh] overflow-hidden bg-site-black text-site-white">
        <motion.div style={{ y: heroY, scale: heroScale, willChange: "transform" }} className="absolute inset-0">
          <div className="absolute inset-0 bg-site-black" />
          <img
            src={heroImg}
            alt="Site 99 — narrative control"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-site-black/60 via-transparent to-site-black" />
        </motion.div>

        {/* Animated red northern-lights aurora */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen">
          <motion.div
            aria-hidden
            className="absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] rounded-full"
            style={{
              background: "radial-gradient(closest-side, hsl(var(--site-red) / 0.55), transparent 70%)",
              filter: "blur(80px)",
            }}
            animate={{ x: [0, 80, -40, 0], y: [0, 60, -30, 0], scale: [1, 1.15, 0.95, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute top-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full"
            style={{
              background: "radial-gradient(closest-side, hsl(var(--site-red) / 0.45), transparent 70%)",
              filter: "blur(90px)",
            }}
            animate={{ x: [0, -100, 50, 0], y: [0, -40, 70, 0], scale: [1, 0.9, 1.2, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-0 left-1/3 w-[60vw] h-[60vw] rounded-full"
            style={{
              background: "radial-gradient(closest-side, hsl(var(--site-red) / 0.35), transparent 70%)",
              filter: "blur(100px)",
            }}
            animate={{ x: [0, 60, -80, 0], y: [0, -50, 30, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="absolute top-32 right-6 md:right-10 label text-[11px] text-white/80 text-right flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-site-red rounded-full animate-pulse" /> Residency Open
        </div>

        <motion.div style={{ y: titleY }} className="relative z-10 min-h-[110vh] px-6 md:px-10 pt-40 pb-24 md:pb-32 flex flex-col justify-end gap-10 md:gap-14">
          <div className="space-y-1 md:space-y-2">
            <div className="overflow-hidden">
              <motion.h1
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="display text-fluid-hero leading-[0.9]"
              >
                Brands that
              </motion.h1>
            </div>
            <div className="overflow-hidden">
              <motion.h1
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                className="display text-fluid-hero leading-[0.9]"
              >
                travel <span className="text-site-red">without</span> us.
              </motion.h1>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          >
            <p className="max-w-md text-fluid-md text-white/85 font-medium">
              Site 99 is a creative residency. We build entertaining content and brand systems that earn attention and keep it.
            </p>
            <Link
              to="/access"
              data-hover
              className="group inline-flex items-center gap-4 bg-site-red text-site-white px-7 py-4 rounded-full label text-xs hover:bg-site-white hover:text-site-red transition-colors self-start md:self-auto"
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
          <span>In Residency </span>
          <span className="hidden md:inline">Scroll →</span>
        </div>
        <Marquee items={residents} />
      </section>

      {/* THE STUDIO — who we are */}
      <section className="relative px-6 md:px-10 py-32 md:py-40 bg-background overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-7 relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
          >
            <img
              src={studioAsset.url}
              alt="The Site 99 studio team"
              loading="lazy"
              decoding="async"
              width={1200}
              height={900}
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 scale-105 hover:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-site-black/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="md:col-span-5"
          >
            <div className="label text-site-red mb-4">The Studio</div>
            <h2 className="display text-fluid-xl leading-[0.95]">
              A small <span className="text-site-red">resident</span> team.
            </h2>
            <p className="mt-8 text-fluid-md text-muted-foreground max-w-md">
              Self-taught specialists. We work together, in residence, on the brands we believe in. No freelancers, no handoffs, no excuses.
            </p>
          </motion.div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section ref={manifestoRef} className="px-6 md:px-10 py-32 md:py-48 max-w-7xl mx-auto">
        <div className="label text-site-red mb-8">Doctrine</div>
        <h2 className="display text-fluid-xl leading-[0.95] flex flex-wrap gap-x-4 gap-y-2 text-left">
          {words.map((w, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            const opacity = useTransform(smoothMp, [start * 0.7, end * 0.7], [0.15, 1]);
            return (
              <motion.span key={i} style={{ opacity }} className={w.includes("attention.") || w.includes("us.") ? "text-site-red" : ""}>
                {w}
              </motion.span>
            );
          })}
        </h2>
      </section>

      {/* THE MATH — viral economics pull-quote */}
      <section className="section-dark px-6 md:px-10 py-32 md:py-48 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="label text-site-red mb-8">The Math</div>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="display text-fluid-xl leading-[1.0]"
          >
            One viral clip on TikTok can save you{" "}
            <span className="text-site-red">10 Million UGX</span>{" "}
            in traditional TV advertising.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-10 max-w-2xl text-fluid-md text-white/70"
          >
            Attention is the new media spend. We engineer the clip, the system, and the residency that keeps your brand in the feed long after the campaign ends.
          </motion.p>
        </div>
      </section>

      {/* STATS */}
      <section className="section-dark border-b grid grid-cols-2 md:grid-cols-4">
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

      {/* ARCHIVE GLIMPSE */}
      <section className="px-6 md:px-10 py-32 md:py-40 bg-background">
        <div className="flex items-end justify-between mb-12 md:mb-16">
          <div>
            <div className="label text-site-red mb-4">N° 02 / Archive</div>
            <h2 className="display text-fluid-xl">Selected Work</h2>
          </div>
          <Link
            to="/archive"
            data-hover
            className="hidden md:inline-flex items-center gap-3 label text-xs text-foreground hover:text-site-red transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {glimpseProjects.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: (i % 2) * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={i % 2 === 1 ? "md:translate-y-16" : ""}
            >
              <Link to="/archive" data-hover className="group block">
                <div className="overflow-hidden rounded-2xl bg-muted aspect-[4/5]">
                  <img
                    src={p.img}
                    alt={p.title}
                    loading="lazy"
                    width={800}
                    height={1000}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <div className="display text-2xl md:text-3xl">{p.title}</div>
                    <div className="mono text-xs text-muted-foreground mt-1">{p.client}</div>
                  </div>
                  <div className="label text-[10px] text-muted-foreground">{p.tag}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="md:hidden mt-10 text-center">
          <Link to="/archive" data-hover className="inline-flex items-center gap-3 label text-xs text-site-red">
            View all →
          </Link>
        </div>
      </section>

      {/* PHILOSOPHY GLIMPSE */}
      <section className="section-dark px-6 md:px-10 py-32 md:py-40 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12 md:mb-16">
            <div>
              <div className="label text-site-red mb-4">N° 04 / Philosophy</div>
              <h2 className="display text-fluid-xl">Narrative <span className="text-site-red">Control.</span></h2>
            </div>
            <Link to="/philosophy" data-hover className="hidden md:inline-flex label text-xs text-white hover:text-site-red transition-colors">
              Read the doctrine →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            {doctrines.map((d, i) => (
              <motion.div
                key={d.t}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-site-black p-8 md:p-12 group hover:bg-site-red transition-colors duration-500"
              >
                <div className="mono text-xs text-white/50 group-hover:text-white">0{i + 1}</div>
                <div className="display text-3xl md:text-5xl mt-4">{d.t}</div>
                <p className="mt-6 text-white/70 group-hover:text-white text-fluid-md max-w-md">{d.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* RESIDENTS GLIMPSE */}
      <section className="px-6 md:px-10 py-32 md:py-40 bg-background">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="label text-site-red mb-4">N° 03 / Residents</div>
            <h2 className="display text-fluid-xl">In Residency</h2>
          </div>
          <Link to="/residents" data-hover className="hidden md:inline-flex label text-xs hover:text-site-red transition-colors">
            See all residents →
          </Link>
        </div>
        <div className="border-t border-border">
          {residents.slice(0, 4).map((r, i) => (
            <motion.div
              key={r}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="grid grid-cols-12 items-center border-b border-border py-6 md:py-8 group hover:bg-site-red transition-colors duration-300 cursor-default"
            >
              <div className="col-span-1 mono text-xs text-muted-foreground group-hover:text-site-white px-2">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-8 display text-2xl md:text-4xl group-hover:text-site-white group-hover:translate-x-3 transition-transform duration-500">
                {r}
              </div>
              <div className="col-span-3 text-right mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-site-white pr-2">
                Active
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA SLAB */}
      <section className="relative px-6 md:px-10 py-32 md:py-48 text-center bg-site-black text-site-white overflow-hidden">
        <img
          src={ctaAsset.url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-site-black/80 via-site-black/60 to-site-black" />
        <div className="relative z-10">
          <motion.h3
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="display text-fluid-xl"
          >
            Ready to build a brand <br className="hidden md:block" />that <span className="text-site-red">travels</span>?
          </motion.h3>
          <p className="label text-white/60 mt-6">Qualify for residency</p>
          <Link
            to="/access"
            data-hover
            className="mt-10 inline-flex items-center gap-4 bg-site-red text-site-white px-8 py-5 rounded-full label text-xs hover:bg-site-white hover:text-site-red transition-colors"
          >
            Request Access →
          </Link>
        </div>
      </section>
    </Layout>
  );
}
