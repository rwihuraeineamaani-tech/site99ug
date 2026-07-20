import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Event = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  cover_url: string | null;
};

type Tier = { id: string; name: string; price_ugx: number; capacity: number; sort: number };

const ugx = (n: number) => `UGX ${n.toLocaleString()}`;

export default function EventDetail() {
  const { slug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const isUuid = !!slug && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const q = supabase.from("events").select("*").eq("published", true);
      const { data: e } = await (isUuid ? q.eq("id", slug) : q.eq("slug", slug)).maybeSingle();
      setEvent(e as Event | null);
      if (e) {
        const { data: t } = await supabase.from("ticket_tiers").select("*").eq("event_id", (e as any).id).order("sort");
        setTiers((t as Tier[]) || []);
      }
      setLoading(false);
    })();
  }, [slug]);


  const total = useMemo(
    () => tiers.reduce((sum, t) => sum + (qty[t.id] || 0) * t.price_ugx, 0),
    [tiers, qty]
  );
  const totalQty = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty]);

  const checkout = async () => {
    if (!event) return;
    if (totalQty === 0) return toast.error("Select at least one ticket");
    if (!buyer.name || !buyer.email || !buyer.phone) return toast.error("Fill in all buyer details");
    if (!/^\+?\d{9,15}$/.test(buyer.phone.replace(/\s/g, ""))) return toast.error("Enter a valid phone number");
    setSubmitting(true);
    try {
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity }));
      const returnUrl = `${window.location.origin}/tickets/thank-you`;
      const { data, error } = await supabase.functions.invoke("pesapal-checkout", {
        body: { eventId: event.id, items, buyer, returnUrl },
      });
      if (error || !data?.redirect_url) throw new Error(data?.error || error?.message || "Checkout failed");
      sessionStorage.setItem("site99_last_ref", data.merchant_reference);
      window.location.href = data.redirect_url;
    } catch (e: any) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Seo
        title={`${event?.title || "Event"} — Site 99 Tickets`}
        description={event?.description?.slice(0, 155) || "Buy tickets with MoMo or Airtel Money."}
        path={`/events/${slug}`}
      />
      <section className="pt-28 pb-16 px-8 md:px-16">
        {loading && <p className="mono text-xs">Loading…</p>}
        {!loading && !event && <p className="mono text-xs">Event not found.</p>}
        {event && (
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              {event.cover_url && (
                <img src={event.cover_url} alt={event.title} className="w-full rounded-lg mb-8" loading="lazy" decoding="async" />
              )}
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">
                {new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
              </div>
              <h1 className="display text-5xl md:text-7xl mt-3 leading-none">{event.title}</h1>
              {event.venue && <p className="mt-3 text-lg text-muted-foreground">{event.venue}</p>}
              {event.description && <p className="mt-6 whitespace-pre-line">{event.description}</p>}
            </div>

            <div>
              <h2 className="display text-3xl mb-6">Tickets</h2>
              <div className="space-y-3">
                {tiers.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="display text-xl">{t.name}</div>
                      <div className="mono text-xs text-muted-foreground">{ugx(t.price_ugx)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQty({ ...qty, [t.id]: Math.max(0, (qty[t.id] || 0) - 1) })}
                        className="w-9 h-9 rounded-full border border-border hover:border-site-red"
                        data-hover
                      >−</button>
                      <span className="mono w-6 text-center">{qty[t.id] || 0}</span>
                      <button
                        onClick={() => setQty({ ...qty, [t.id]: Math.min(20, (qty[t.id] || 0) + 1) })}
                        className="w-9 h-9 rounded-full border border-border hover:border-site-red"
                        data-hover
                      >+</button>
                    </div>
                  </div>
                ))}
                {!tiers.length && <p className="mono text-xs opacity-60">No tiers set for this event yet.</p>}
              </div>

              <div className="mt-8 space-y-4">
                <input required placeholder="Full name" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
                <input required type="email" placeholder="Email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
                <input required placeholder="Phone (MoMo/Airtel, e.g. 256772000000)" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div>
                  <div className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</div>
                  <div className="display text-3xl">{ugx(total)}</div>
                </div>
                <button
                  onClick={checkout}
                  disabled={submitting || total === 0}
                  data-hover
                  className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs disabled:opacity-50 hover:bg-foreground hover:text-background transition-colors"
                >
                  {submitting ? "Opening Pesapal…" : "Pay with MoMo / Airtel"}
                </button>
              </div>
              <p className="mt-4 mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                Secured by Pesapal. You'll receive your QR ticket by email.
              </p>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
