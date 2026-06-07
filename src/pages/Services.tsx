import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";

const services = [
  {
    slug: "brand-strategy",
    n: "01",
    title: "Brand Strategy & Identity",
    lede: "Positioning, naming, and visual identity systems built to travel.",
    body: "We architect the story, the symbol and the system. From the first naming workshop to the final brand book — voice, type, logo, palette, motion. Identity that holds whether it lands on a billboard in Kampala or a phone in Lagos.",
    deliverables: ["Positioning & narrative", "Naming & verbal identity", "Logo & visual system", "Brand guidelines"],
  },
  {
    slug: "content-film",
    n: "02",
    title: "Content & Film",
    lede: "Short-form video, TikTok-native edits, branded films.",
    body: "We script, shoot and cut for the feed. Vertical-first, attention-engineered, residency-ready. One viral clip can save you 10 Million UGX in TV spend — we build the system that makes that the rule, not the exception.",
    deliverables: ["TikTok / Reels production", "Brand films & documentaries", "Photography direction", "Post & motion"],
  },
  {
    slug: "campaigns",
    n: "03",
    title: "Campaigns & Broadcast",
    lede: "Launch campaigns, paid media, earned PR.",
    body: "Integrated campaign architecture — concept, channel plan, media buy and broadcast. We deploy across paid, owned and earned with a single narrative spine so every impression compounds.",
    deliverables: ["Campaign concept & plan", "Paid media (Meta, TikTok, Google)", "PR & press partnerships", "Reporting & optimisation"],
  },
  {
    slug: "residency",
    n: "04",
    title: "Digital Residency",
    lede: "Long-term retainer. Ongoing brand stewardship.",
    body: "The flagship offer. A multi-year residency where we sit inside your brand and run it like our own. Strategy, content, code and broadcast on a monthly cadence. No pitch, no leave.",
    deliverables: ["Monthly strategy & creative", "Always-on content engine", "Channel management", "Quarterly brand reviews"],
  },
  {
    slug: "ai-automation",
    n: "05",
    title: "AI & Automations",
    lede: "CRMs, workflows and AI systems that run your business while you sleep.",
    body: "We build the back-of-house — custom CRMs, lead capture, AI agents, content pipelines and reporting dashboards. The unglamorous infrastructure that turns attention into revenue automatically.",
    deliverables: ["CRM design & implementation", "AI agents & chatbots", "Workflow automation (Make, n8n, Zapier)", "Internal dashboards"],
  },
  {
    slug: "web-design",
    n: "06",
    title: "Website Design",
    lede: "Fast, beautiful, conversion-engineered sites.",
    body: "Custom design and build. Editorial typography, native motion, performance budgets that pass Core Web Vitals. From landing pages to e-commerce to full residency portals.",
    deliverables: ["Design & art direction", "Frontend build", "CMS & e-commerce", "Performance & SEO"],
  },
  {
    slug: "social-media",
    n: "07",
    title: "Social Media Handling",
    lede: "End-to-end channel management. We post, we reply, we report.",
    body: "Daily posting, community management, trend monitoring and reporting across TikTok, Instagram, X, LinkedIn and YouTube Shorts. You stay in the conversation without ever opening the app.",
    deliverables: ["Content calendar & posting", "Community management", "Trend & culture monitoring", "Monthly reporting"],
  },
];

export default function Services() {
  return (
    <Layout>
      <Seo
        title="Services — Site 99"
        description="Brand strategy, content, campaigns, residency, AI automations, web design and social. The full Site 99 service stack."
        path="/services"
      />
      <section className="px-4 md:px-6 pt-24 md:pt-28 pb-12">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 05 / Services</div>
        <h1 className="display text-fluid-hero leading-[0.85]">
          The full <br />
          <span className="text-site-red">stack</span> of residency.
        </h1>
        <p className="mt-8 max-w-xl text-fluid-md text-muted-foreground">
          Seven disciplines under one roof. Pick one or take the whole studio in residence.
        </p>
      </section>

      <section className="border-t border-border">
        {services.map((s, i) => (
          <motion.div
            key={s.slug}
            id={s.slug}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: (i % 3) * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 border-b border-border px-4 md:px-6 py-14 md:py-20 scroll-mt-24"
          >
            <div className="md:col-span-4">
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-4">{s.n}</div>
              <h2 className="display text-3xl md:text-5xl leading-[0.95]">{s.title}</h2>
            </div>
            <div className="md:col-span-5 space-y-6">
              <p className="text-fluid-md text-foreground/90 font-medium">{s.lede}</p>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
            <div className="md:col-span-3">
              <div className="label text-[11px] text-muted-foreground mb-4">Includes</div>
              <ul className="space-y-3">
                {s.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-3 text-sm">
                    <span className="text-site-red mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </section>
    </Layout>
  );
}
