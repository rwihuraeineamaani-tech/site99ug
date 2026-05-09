import { motion } from "framer-motion";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ProjectLightbox } from "@/components/ProjectLightbox";
import { useProjects, type Project } from "@/hooks/useProjects";
import p1 from "@/assets/project-1.jpg";
import p2 from "@/assets/project-2.jpg";
import p3 from "@/assets/project-3.jpg";
import p4 from "@/assets/project-4.jpg";
import p5 from "@/assets/project-5.jpg";
import p6 from "@/assets/project-6.jpg";

const seedMap: Record<string, string> = {
  "/seed/project-1.jpg": p1,
  "/seed/project-2.jpg": p2,
  "/seed/project-3.jpg": p3,
  "/seed/project-4.jpg": p4,
  "/seed/project-5.jpg": p5,
  "/seed/project-6.jpg": p6,
};
const resolveCover = (url: string) => seedMap[url] || url;

export default function Archive() {
  const { data: projects = [], isLoading } = useProjects();
  const [open, setOpen] = useState<Project | null>(null);

  return (
    <Layout>
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-12">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 02 / Archive</div>
        <h1 className="display text-fluid-hero leading-[0.85]">
          Case studies in <br />
          <span className="text-site-red">narrative</span> control.
        </h1>
        <p className="mt-10 max-w-xl text-fluid-md text-muted-foreground">
          A living archive of the brands we have built, broadcast and defended. Each plot is a residency in motion.
        </p>
      </section>

      <section className="border-t border-border px-6 md:px-10 py-12 md:py-16">
        {isLoading ? (
          <div className="mono text-xs text-muted-foreground py-20 text-center">Loading archive…</div>
        ) : projects.length === 0 ? (
          <div className="mono text-xs text-muted-foreground py-20 text-center">No projects yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {projects.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setOpen(p)}
                data-hover
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: (i % 6) * 0.05 }}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary text-left"
              >
                <img
                  src={resolveCover(p.cover_url)}
                  alt={p.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-site-red/0 group-hover:bg-site-red/30 mix-blend-multiply transition-colors duration-500" />
                <div className="absolute inset-0 p-6 md:p-7 flex flex-col justify-between text-site-white">
                  <div className="flex justify-between mono text-[10px] uppercase tracking-[0.3em]">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>{p.year}</span>
                  </div>
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.3em] mb-2 opacity-80">{p.tag} · {p.client}</div>
                    <h3 className="display text-3xl md:text-4xl">{p.title}</h3>
                    <div className="mt-3 h-px w-0 bg-site-white group-hover:w-24 transition-all duration-700" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      <ProjectLightbox project={open} onClose={() => setOpen(null)} />
    </Layout>
  );
}
