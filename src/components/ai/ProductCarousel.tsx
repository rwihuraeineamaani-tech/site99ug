import { motion } from "framer-motion";

export const ProductCarousel = () => {
  return (
    <div className="-mx-8 md:-mx-16 px-8 md:px-16 overflow-x-auto no-scrollbar">
      <div className="flex gap-4 min-w-max pb-2">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="w-[300px] sm:w-[360px] rounded-none border border-white/25 bg-black p-6"
        >
          <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/50">Product 01</span>
          <h3 className="mt-3 text-xl font-bold text-white">Kazi Intelligent Systems</h3>
          <p className="mt-2 text-sm text-white/55">Intelligent workflow systems, powered by machine learning and AI.</p>
          <a
            href="#demo"
            className="mt-5 inline-block tech text-[11px] uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
          >
            Learn more →
          </a>
        </motion.article>

        {[2, 3].map((n) => (
          <div
            key={n}
            aria-hidden
            className="w-[240px] sm:w-[280px] rounded-none border border-white/10 bg-black p-6 select-none"
          >
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
