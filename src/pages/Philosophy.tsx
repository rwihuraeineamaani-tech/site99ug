import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Layout } from "@/components/Layout";

const doctrines = [
  { t: "Travel", d: "We build brands that travel without us." },
  { t: "Attention", d: "Online attention will outvalue land. We help you earn it." },
  { t: "Entertain", d: "Entertaining content is the shortest path to trust." },
  { t: "Residency", d: "We stay. We don't pitch and leave." },
  { t: "Systems", d: "Identity, voice, and distribution as one system." },
  { t: "Craft", d: "Frame by frame. No filler." },
];

export default function Philosophy() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [0, 720]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.4, 1]);
  const numColor = useTransform(scrollYProgress, [0, 0.5, 1], ["#ffffff", "#B60000", "#ffffff"]);

  return (
    <Layout>
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 04 / Philosophy</div>
        <h1 className="display text-fluid-hero">Narrative<br/><span className="text-site-red">Control.</span></h1>
        <p className="mt-10 max-w-2xl text-fluid-md text-muted-foreground">
          Most agencies sell visibility. We sell sovereignty. Narrative Control is the discipline of
          making sure your brand isn't just seen — it sets the terms by which it is understood.
        </p>
      </section>

      {/* 3D scrolling 99 */}
      <section ref={ref} className="relative h-[300vh] border-t border-border">
        <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden bg-site-black">
          <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: 1600 }}>
            <motion.div
              style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }}
              className="display select-none relative"
            >
              {/* Extruded depth layers — back to front */}
              {Array.from({ length: 28 }).map((_, i) => {
                const depth = 28 - i;
                const lightness = Math.max(4, 22 - depth * 0.7);
                const sat = Math.max(0, 70 - depth * 2.5);
                return (
                  <span
                    key={i}
                    aria-hidden
                    className="text-[40vw] leading-none block absolute inset-0 tracking-tighter"
                    style={{
                      fontFamily: "'Archivo Black', system-ui, sans-serif",
                      transform: `translateZ(${-depth * 3}px)`,
                      color: `hsl(0 ${sat}% ${lightness}%)`,
                    }}
                  >
                    99
                  </span>
                );
              })}
              {/* Front face */}
              <motion.span
                style={{
                  color: numColor as any,
                  transform: "translateZ(8px)",
                  textShadow: "0 0 80px rgba(182,0,0,0.55), 0 0 30px rgba(182,0,0,0.4)",
                }}
                className="text-[40vw] leading-none block relative"
              >
                99
              </motion.span>
            </motion.div>
          </div>
          <div className="absolute bottom-10 left-6 md:left-10 label text-[11px] text-white/60 max-w-xs">
            The 99 turns as you scroll. Each rotation is a doctrine.
          </div>
          <div className="absolute top-32 right-6 md:right-10 label text-[11px] text-site-red">
            Scroll to turn
          </div>
        </div>
      </section>

      {/* Doctrines */}
      <section className="px-6 md:px-10 py-24 border-t border-border bg-background">
        <div className="flex items-end justify-between mb-12">
          <h2 className="display text-fluid-xl">Our <span className="text-site-red">Doctrine</span></h2>
          <span className="label text-muted-foreground hidden md:block">What we believe, in practice</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-border">
          {doctrines.map((d, i) => (
            <motion.div
              key={d.t}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border-r border-b border-border p-6 md:p-10 group hover:bg-site-red transition-colors duration-500"
            >
              <span className="label text-muted-foreground group-hover:text-white">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="display text-3xl md:text-5xl mt-6 group-hover:text-white">{d.t}</h3>
              <p className="mt-4 text-muted-foreground group-hover:text-white/90 text-base font-medium">{d.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-10 py-32 max-w-4xl">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">Doctrine</div>
        <p className="display text-fluid-lg leading-tight">
          "A brand without narrative control is a tenant. A brand <span className="text-site-red">with</span> it is the landlord."
        </p>
        <p className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-6">— SITE 99 Manifesto, Article 099</p>
      </section>
    </Layout>
  );
}
