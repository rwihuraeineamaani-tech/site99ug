import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import p1 from "@/assets/project-1.jpg";
import p2 from "@/assets/project-2.jpg";
import p3 from "@/assets/project-3.jpg";
import p4 from "@/assets/project-4.jpg";
import p5 from "@/assets/project-5.jpg";
import p6 from "@/assets/project-6.jpg";

const projects = [
  { n: "01", title: "Black Halo", client: "Kweli Creatives", year: "2025", tag: "Identity / Film", img: p1 },
  { n: "02", title: "Silhouette Theory", client: "Vanta House", year: "2024", tag: "Campaign", img: p2 },
  { n: "03", title: "The Rotunda", client: "Atlas & Ore", year: "2024", tag: "Architecture", img: p3 },
  { n: "04", title: "Fog Dispatch", client: "Mercury Studio", year: "2024", tag: "Editorial Film", img: p4 },
  { n: "05", title: "Skyline Audit", client: "Northstar", year: "2023", tag: "Brand System", img: p5 },
  { n: "06", title: "Surface Tension", client: "Cipher Goods", year: "2023", tag: "Packaging", img: p6 },
];

export default function Archive() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-78%"]);
  const [active, setActive] = useState(0);

  return (
    <Layout hideFooter>
      <div ref={ref} className="relative h-[600vh] bg-site-black">
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 md:px-10 pt-28 pb-6 flex items-end justify-between border-b border-border">
            <div>
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">N° 02 / Archive</div>
              <h1 className="display text-fluid-xl">Case Studies in Narrative Control</h1>
            </div>
            <div className="hidden md:flex flex-col items-end mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <span>{String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
              <span className="mt-1">Scroll →</span>
            </div>
          </div>

          {/* Horizontal track */}
          <motion.div style={{ x }} className="flex-1 flex items-center gap-6 md:gap-10 px-6 md:px-10 will-change-transform">
            {projects.map((p, i) => (
              <a
                key={p.n}
                href="#"
                onMouseEnter={() => setActive(i)}
                data-hover
                className="group relative flex-none w-[80vw] md:w-[55vw] lg:w-[42vw] h-[68vh] overflow-hidden bg-secondary"
              >
                <img
                  src={p.img}
                  alt={p.title}
                  loading="lazy"
                  width={1200}
                  height={1500}
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-site-red/0 group-hover:bg-site-red/30 mix-blend-multiply transition-colors duration-500" />
                <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between text-site-white">
                  <div className="flex justify-between mono text-xs uppercase tracking-[0.3em]">
                    <span>{p.n}</span>
                    <span>{p.year}</span>
                  </div>
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.3em] mb-3 opacity-80">{p.tag} · {p.client}</div>
                    <h3 className="display text-4xl md:text-6xl">{p.title}</h3>
                    <div className="mt-4 h-px w-0 bg-site-white group-hover:w-32 transition-all duration-700" />
                  </div>
                </div>
              </a>
            ))}
            <div className="flex-none w-[80vw] md:w-[55vw] lg:w-[42vw] h-[68vh] flex flex-col items-center justify-center border border-dashed border-site-red text-center px-8">
              <div className="display text-6xl md:text-8xl text-site-red">99</div>
              <p className="mono text-xs uppercase tracking-[0.3em] mt-6">The next plot is yours.</p>
            </div>
          </motion.div>

          <div className="border-t border-border px-6 md:px-10 py-4 mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex justify-between">
            <span>Drag or scroll to traverse the archive</span>
            <span>{projects[active]?.client}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
