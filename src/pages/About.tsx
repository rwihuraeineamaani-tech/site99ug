import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import studioAsset from "@/assets/IMG_5289.jpg.asset.json";

const pillars = [
  { k: "Residency", v: "We sit inside the brand. No pitch, no leave." },
  { k: "Narrative Control", v: "Every channel speaks with one voice." },
  { k: "Local Lens", v: "Built in Uganda. Travels everywhere." },
];

export default function About() {
  return (
    <Layout>
      <Seo
        title="About — Site 99"
        description="Site 99 is a creative residency from Kampala building brands that travel without us."
        path="/about"
      />
      <section className="px-4 md:px-6 pt-24 md:pt-28 pb-12">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 06 / About</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-7">
            <h1 className="display text-fluid-hero leading-[0.85]">
              A small studio <br />
              <span className="text-site-red">in residence.</span>
            </h1>
            <p className="mt-8 max-w-xl text-fluid-md text-muted-foreground">
              Site 99 is a creative residency based in Kampala. We build entertaining content and brand systems for ambitious teams across East Africa and beyond.
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-5 relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
          >
            <img src={studioAsset.url} alt="Site 99 studio" loading="lazy" className="w-full h-full object-cover" />
          </motion.div>
        </div>
      </section>

      <section className="border-t border-border px-4 md:px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="label text-site-red mb-4">The Studio</div>
            <h2 className="display text-fluid-xl leading-[0.95]">Self-taught. Resident. Relentless.</h2>
          </div>
          <div className="md:col-span-7 space-y-6">
            <p className="text-fluid-md text-foreground/90">
              No freelancers, no handoffs, no excuses. The same hands that strategise also shoot, cut and ship. We work together, in residence, on the brands we believe in.
            </p>
            <p className="text-muted-foreground">
              We exist because attention is the new media spend. The old playbook — TV buys, billboard rotations, agency pitches — is too slow and too expensive for the brands we serve. We build the new one.
            </p>
          </div>
        </div>
      </section>

      <section className="section-dark px-4 md:px-6 py-16 md:py-24 border-t">
        <div className="label text-site-red mb-10">Pillars</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {pillars.map((p, i) => (
            <motion.div
              key={p.k}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border-l-2 border-site-red pl-6"
            >
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">0{i + 1}</div>
              <h3 className="display text-3xl md:text-4xl mb-4">{p.k}</h3>
              <p className="text-white/70">{p.v}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-4 md:px-6 py-16 md:py-24 text-center border-t border-border">
        <h2 className="display text-fluid-xl">Want to work with us?</h2>
        <Link
          to="/access"
          data-hover
          className="mt-8 inline-flex items-center gap-4 bg-site-red text-site-white px-7 py-4 rounded-full label text-xs hover:bg-site-black transition-colors"
        >
          Request Residency →
        </Link>
      </section>
    </Layout>
  );
}
