import { motion } from "framer-motion";
import kaziMark from "@/assets/kazi-mark.png.asset.json";
import { PoweredByLockup } from "./PoweredByLockup";

const Star = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" aria-hidden className={className}>
    <path d="M50 0 C54 32 68 46 100 50 C68 54 54 68 50 100 C46 68 32 54 0 50 C32 46 46 32 50 0 Z" fill="currentColor" />
  </svg>
);

export const ProductCarousel = () => {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-none border border-white/20 bg-black p-7 md:p-10"
      >
        <Star className="pointer-events-none absolute -right-16 -bottom-24 h-[26rem] w-[26rem] text-white/[0.035]" />

        <div className="relative">
          <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Product 01</span>
          <img src={kaziMark.url} alt="Kazi Intelligent Systems" loading="lazy" className="mt-5 h-7 md:h-9 w-auto" />
          <p className="mt-2 tech text-[11px] uppercase tracking-[0.24em] text-white/45">Intelligent Systems</p>

          <p className="mt-7 max-w-xl text-white/75 leading-relaxed">
            Kazi means work. It stands for the systems that make everyday work faster and easier, for everyone, and
            everything. We make your company more intelligent, while keeping the human creativity at its core.
          </p>
          <p className="mt-4 max-w-xl text-sm text-white/45 leading-relaxed">
            Developed under the AI &amp; Automation sector of Site 99 UG LTD — intelligent workflow systems powered by
            machine learning and AI.
          </p>

          <div className="mt-9 flex items-end justify-between gap-6">
            <a
              href="#demo"
              className="tech text-[11px] uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
            >
              Learn more →
            </a>
            <PoweredByLockup className="h-12 opacity-70" />
          </div>
        </div>
      </motion.article>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {[2, 3].map((n) => (
          <div key={n} aria-hidden className="rounded-none border border-white/10 bg-black p-6 select-none">
            <div className="blur-[6px] opacity-30">
              <span className="tech text-[10px] uppercase tracking-[0.24em] text-white">Product 0{n}</span>
              <h3 className="mt-3 text-xl font-bold text-white">Classified system</h3>
              <p className="mt-2 text-sm text-white/70">A system in development inside the sector.</p>
            </div>
            <p className="mt-5 tech text-[11px] uppercase tracking-[0.22em] text-white/35">More products coming soon.</p>
          </div>
        ))}
      </div>
    </div>
  );
};
