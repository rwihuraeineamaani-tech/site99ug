import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Layout } from "@/components/Layout";

const big10 = [
  "Identity", "Narrative", "Film", "Editorial",
  "System", "Surface", "Voice", "Frame", "Distribution", "Memory",
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
          <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: 1200 }}>
            <motion.div
              style={{ rotateX, rotateY, scale, color: numColor as any }}
              className="display select-none"
            >
              <span className="text-[40vw] leading-none block" style={{ textShadow: "0 0 80px rgba(182,0,0,0.4)" }}>
                99
              </span>
            </motion.div>
          </div>
          <div className="absolute bottom-10 left-6 md:left-10 mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground max-w-xs">
            // The 99 rotates as you descend. Each turn is a doctrine.
          </div>
          <div className="absolute top-32 right-6 md:right-10 mono text-[10px] uppercase tracking-[0.3em] text-site-red">
            ROTATION_LOCKED · SCROLL_TO_TURN
          </div>
        </div>
      </section>

      {/* Big 10 */}
      <section className="px-6 md:px-10 py-24 border-t border-border">
        <div className="flex items-end justify-between mb-12">
          <h2 className="display text-fluid-xl">The <span className="text-site-red">Big 10</span></h2>
          <span className="mono text-xs uppercase tracking-[0.3em] text-muted-foreground hidden md:block">Ten levers of narrative control</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 border-t border-l border-border">
          {big10.map((w, i) => (
            <motion.div
              key={w}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border-r border-b border-border aspect-square flex flex-col justify-between p-5 md:p-8 group hover:bg-site-red transition-colors duration-500"
            >
              <span className="mono text-xs text-muted-foreground group-hover:text-site-white">{String(i + 1).padStart(2, "0")}</span>
              <span className="display text-2xl md:text-4xl group-hover:translate-y-[-4px] transition-transform">{w}</span>
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
