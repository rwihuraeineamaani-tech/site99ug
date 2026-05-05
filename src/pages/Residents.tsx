import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";

const residents = [
  { name: "Kweli Creatives", territory: "Global · Art Gallery", since: "2022", status: "Active" },
  { name: "Rolex Guy Uganda", territory: "Kampala · Fast Food", since: "2023", status: "Active" },
  { name: "Uganda Youth Forum", territory: "Kampala · NGO", since: "2023", status: "Active" },
  { name: "The Lawns Restaurant", territory: "Kololo · Fine Dining", since: "2023", status: "Active" },
  { name: "Montana International School", territory: "Muyenga · Education", since: "2024", status: "Active" },
  { name: "Nehemiah Consultants", territory: "Kampala · Advisory", since: "2024", status: "Active" },
];

export default function Residents() {
  return (
    <Layout>
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 03 / Residents</div>
        <h1 className="display text-fluid-hero leading-[0.85]">
          Those who have <br />
          <span className="text-site-red">secured</span> their territory.
        </h1>
        <p className="mt-10 max-w-xl text-fluid-md text-muted-foreground">
          Residency at SITE 99 is not granted. It is qualified for. Each resident occupies a permanent plot in our narrative grid.
        </p>
      </section>

      <section className="border-t border-border">
        <div className="grid grid-cols-12 mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-b border-border px-6 md:px-10 py-4">
          <div className="col-span-1">N°</div>
          <div className="col-span-5 md:col-span-4">Resident</div>
          <div className="col-span-3">Territory</div>
          <div className="col-span-2 hidden md:block">Since</div>
          <div className="col-span-3 md:col-span-2 text-right">Status</div>
        </div>
        {residents.map((r, i) => (
          <motion.a
            key={r.name}
            href="#"
            data-hover
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-12 items-center border-b border-border px-6 md:px-10 py-6 md:py-8 group hover:bg-site-red transition-colors duration-300"
          >
            <div className="col-span-1 mono text-xs text-muted-foreground group-hover:text-site-white">{String(i + 1).padStart(2, "0")}</div>
            <div className="col-span-5 md:col-span-4 display text-2xl md:text-5xl group-hover:translate-x-3 transition-transform duration-500">
              {r.name}
            </div>
            <div className="col-span-3 mono text-xs uppercase tracking-widest group-hover:text-site-white">{r.territory}</div>
            <div className="col-span-2 mono text-xs hidden md:block group-hover:text-site-white">{r.since}</div>
            <div className="col-span-3 md:col-span-2 text-right mono text-[10px] uppercase tracking-[0.3em]">
              <span className={`inline-flex items-center gap-2 ${r.status === "New" ? "text-site-red group-hover:text-site-white" : "text-muted-foreground group-hover:text-site-white"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {r.status}
              </span>
            </div>
          </motion.a>
        ))}
      </section>

      <section className="px-6 md:px-10 py-32 grid md:grid-cols-3 gap-10 border-t border-border">
        {[
          { k: "Exclusivity", v: "We do not take everyone. Plots are limited and qualified for." },
          { k: "Longevity", v: "A resident stays. Monthly retainers, multi-year tenure, compounding equity." },
          { k: "Control", v: "We are the landlord of the digital space your brand occupies." },
        ].map((b, i) => (
          <motion.div
            key={b.k}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="border-l-2 border-site-red pl-6"
          >
            <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-3">0{i + 1}</div>
            <h3 className="display text-3xl md:text-4xl mb-4">{b.k}</h3>
            <p className="text-muted-foreground">{b.v}</p>
          </motion.div>
        ))}
      </section>
    </Layout>
  );
}
