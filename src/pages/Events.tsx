import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

type Event = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  cover_url: string | null;
};

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("events")
      .select("id,slug,title,description,venue,starts_at,cover_url")
      .eq("published", true)
      .order("starts_at", { ascending: true })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <Layout>
      <Seo
        title="Events & Tickets — Site 99"
        description="Book tickets to Site 99 events. Pay with MTN MoMo or Airtel Money."
        path="/events"
      />
      <section className="pt-28 pb-16 px-8 md:px-16">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">N° 08 / Events</div>
        <h1 className="display text-fluid-hero leading-[0.9]">Upcoming <span className="text-site-red">gatherings.</span></h1>
        <p className="mt-6 max-w-xl text-muted-foreground">Tickets settle to Mobile Money in seconds. Bring the QR to the gate.</p>

        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="mono text-xs">Loading…</p>}
          {!loading && !events.length && <p className="mono text-xs opacity-60">No events published yet.</p>}
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/events/${e.slug}`} data-hover className="group block border border-border rounded-lg overflow-hidden hover:border-site-red transition-colors">
                {e.cover_url ? (
                  <div className="aspect-video overflow-hidden">
                    <img src={e.cover_url} alt={e.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="aspect-video bg-site-red/10" />
                )}
                <div className="p-6">
                  <div className="mono text-xs uppercase tracking-[0.2em] text-site-red">
                    {new Date(e.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <h2 className="display text-3xl mt-2 leading-tight">{e.title}</h2>
                  {e.venue && <p className="mt-2 text-sm text-muted-foreground">{e.venue}</p>}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
