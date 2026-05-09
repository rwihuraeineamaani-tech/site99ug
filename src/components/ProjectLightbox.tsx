import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import type { Project } from "@/hooks/useProjects";

export const ProjectLightbox = ({ project, onClose }: { project: Project | null; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = project ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [project, onClose]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[300] bg-site-black/95 backdrop-blur overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-6xl mx-auto p-6 md:p-12 pt-24"
          >
            <button
              onClick={onClose}
              data-hover
              className="fixed top-6 right-6 z-10 mono text-xs uppercase tracking-[0.3em] text-site-white hover:text-site-red transition"
            >
              Close ✕
            </button>

            <div className="aspect-[4/5] md:aspect-[16/10] w-full overflow-hidden rounded-2xl bg-secondary mb-10">
              <img src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex justify-between mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">
              <span>{project.tag}</span>
              <span>{project.year}</span>
            </div>
            <h2 className="display text-fluid-xl text-site-white">{project.title}</h2>
            <div className="mono text-sm uppercase tracking-[0.3em] text-muted-foreground mt-3">
              {project.client}
            </div>

            {project.description && (
              <p className="mt-8 text-fluid-md text-site-white/80 max-w-2xl whitespace-pre-line">
                {project.description}
              </p>
            )}

            {project.gallery_urls?.length > 0 && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.gallery_urls.map((url, i) => (
                  /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? (
                    <video key={i} src={url} controls playsInline className="w-full h-auto rounded-2xl bg-black" />
                  ) : (
                    <img key={i} src={url} alt={`${project.title} ${i + 1}`} className="w-full h-auto rounded-2xl" loading="lazy" />
                  )
                ))}
              </div>
            )}

            {project.external_url && (
              <a
                href={project.external_url}
                target="_blank"
                rel="noreferrer"
                data-hover
                className="mt-12 inline-flex items-center gap-3 bg-site-red text-site-white px-8 py-4 rounded-full label text-xs hover:bg-site-white hover:text-site-black transition-colors"
              >
                View Project →
              </a>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
