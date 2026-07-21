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
  momo_number: string | null;
  airtel_number: string | null;
};

type Tier = {
  id: string;
  name: string;
  price_ugx: number;
  capacity: number;
  sort: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
};

const ugx = (n: number) => `UGX ${n.toLocaleString()}`;

function tierWindowState(t: Tier) {
  const now = Date.now();
  if (t.sales_start_at && new Date(t.sales_start_at).getTime() > now) return { open: false, label: `Opens ${new Date(t.sales_start_at).toLocaleString()}` };
  if (t.sales_end_at && new Date(t.sales_end_at).getTime() < now) return { open: false, label: "Sales closed" };
  if (t.sales_end_at) return { open: true, label: `Closes ${new Date(t.sales_end_at).toLocaleString()}` };
  return { open: true, label: "" };
}

export default function EventDetail() {
  const { slug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"pesapal" | "manual">("pesapal");
  const [manualProvider, setManualProvider] = useState<"momo" | "airtel">("momo");
  const [tid, setTid] = useState("");
  const [manualDone, setManualDone] = useState<string | null>(null);

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

  const validate = () => {
    if (totalQty === 0) return "Select at least one ticket";
    if (!buyer.name || !buyer.email || !buyer.phone) return "Fill in all buyer details";
    if (!/^\+?\d{9,15}$/.test(buyer.phone.replace(/\s/g, ""))) return "Enter a valid phone number";
    return null;
  };

  const items = () => Object.entries(qty).filter(([, q]) => q > 0).map(([tierId, quantity]) => ({ tierId, quantity }));

  const checkoutPesapal = async () => {
    if (!event) return;
    const err = validate();
    if (err) return toast.error(err);
    setSubmitting(true);
    try {
      const returnUrl = `${window.location.origin}/tickets/thank-you`;
      const { data, error } = await supabase.functions.invoke("pesapal-checkout", {
        body: { eventId: event.id, items: items(), buyer, returnUrl },
      });
      if (error || !data?.redirect_url) throw new Error(data?.error || error?.message || "Checkout failed");
      sessionStorage.setItem("site99_last_ref", data.merchant_reference);
      window.location.href = data.redirect_url;
    } catch (e: any) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  const checkoutManual = async () => {
    if (!event) return;
    const err = validate();
    if (err) return toast.error(err);
    if (!tid || tid.trim().length < 4) return toast.error("Enter the TID from your payment confirmation SMS");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manual-checkout", {
        body: { eventId: event.id, items: items(), buyer, tid: tid.trim(), provider: manualProvider },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Submission failed");
      setManualDone(data.merchant_reference);
      toast.success("Submitted for confirmation");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const payLabel = {
    momo: { name: "MTN MoMo", number: event?.momo_number || "not set", code: "*165#" },
    airtel: { name: "Airtel Money", number: event?.airtel_number || "not set", code: "*185#" },
  }[manualProvider];

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
              {manualDone ? (
                <div className="border border-site-red rounded-lg p-8">
                  <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Submitted</div>
                  <h2 className="display text-3xl mt-3">Awaiting confirmation</h2>
                  <p className="mt-4 text-muted-foreground">
                    Your TID <span className="mono">{tid}</span> was received. Our team is verifying the payment on
                    {" "}{payLabel.name}. You'll get your ticket by email at <strong>{buyer.email}</strong> once confirmed.
                  </p>
                  <p className="mono text-[10px] mt-4 uppercase tracking-[0.2em] text-muted-foreground">Ref: {manualDone}</p>
                </div>
              ) : (
              <>
              <h2 className="display text-3xl mb-6">Tickets</h2>
              <div className="space-y-3">
                {tiers.map((t) => {
                  const ws = tierWindowState(t);
                  return (
                    <div key={t.id} className={`border border-border rounded-lg p-5 flex items-center justify-between gap-4 ${!ws.open ? "opacity-50" : ""}`}>
                      <div>
                        <div className="display text-xl">{t.name}</div>
                        <div className="mono text-xs text-muted-foreground">{ugx(t.price_ugx)}</div>
                        {ws.label && <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{ws.label}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={!ws.open}
                          onClick={() => setQty({ ...qty, [t.id]: Math.max(0, (qty[t.id] || 0) - 1) })}
                          className="w-9 h-9 rounded-full border border-border hover:border-site-red disabled:opacity-30"
                          data-hover
                        >−</button>
                        <span className="mono w-6 text-center">{qty[t.id] || 0}</span>
                        <button
                          disabled={!ws.open}
                          onClick={() => setQty({ ...qty, [t.id]: Math.min(20, (qty[t.id] || 0) + 1) })}
                          className="w-9 h-9 rounded-full border border-border hover:border-site-red disabled:opacity-30"
                          data-hover
                        >+</button>
                      </div>
                    </div>
                  );
                })}
                {!tiers.length && <p className="mono text-xs opacity-60">No tiers set for this event yet.</p>}
              </div>

              <div className="mt-8 space-y-4">
                <input required placeholder="Full name" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
                <input required type="email" placeholder="Email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
                <input required placeholder="Phone (MoMo/Airtel, e.g. 256772000000)" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3" />
              </div>

              {/* Payment method */}
              <div className="mt-8">
                <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Payment method</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod("pesapal")}
                    className={`border rounded-lg p-4 text-left ${method === "pesapal" ? "border-site-red" : "border-border"}`}
                    data-hover
                  >
                    <div className="display text-lg">Pesapal</div>
                    <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Auto · MoMo / Airtel / Card</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("manual")}
                    className={`border rounded-lg p-4 text-left ${method === "manual" ? "border-site-red" : "border-border"}`}
                    data-hover
                  >
                    <div className="display text-lg">Manual TID</div>
                    <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Pay first · Submit SMS TID</div>
                  </button>
                </div>
              </div>

              {method === "manual" && (
                <div className="mt-6 border border-border rounded-lg p-5 space-y-4">
                  <div className="flex gap-2">
                    {(["momo", "airtel"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setManualProvider(p)}
                        className={`px-4 py-2 rounded-full mono text-[10px] uppercase tracking-[0.2em] border ${manualProvider === p ? "border-site-red text-site-red" : "border-border"}`}
                        data-hover
                      >
                        {p === "momo" ? "MTN MoMo" : "Airtel Money"}
                      </button>
                    ))}
                  </div>
                  <div className="mono text-xs text-muted-foreground leading-relaxed">
                    <div>1. Dial <span className="text-foreground">{payLabel.code}</span> and send <span className="text-foreground">{ugx(total || 0)}</span> to</div>
                    <div className="display text-2xl text-foreground mt-1">{payLabel.number}</div>
                    <div className="mt-2">2. Paste the TID from the confirmation SMS below.</div>
                  </div>
                  <input
                    placeholder="Transaction ID (e.g. CI250721.1234.A56789)"
                    value={tid}
                    onChange={(e) => setTid(e.target.value)}
                    className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-3 mono text-sm"
                  />
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</div>
                  <div className="display text-3xl">{ugx(total)}</div>
                </div>
                <button
                  onClick={method === "pesapal" ? checkoutPesapal : checkoutManual}
                  disabled={submitting || total === 0}
                  data-hover
                  className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs disabled:opacity-50 hover:bg-foreground hover:text-background transition-colors"
                >
                  {submitting
                    ? method === "pesapal" ? "Opening Pesapal…" : "Submitting…"
                    : method === "pesapal" ? "Pay with Pesapal" : "Submit TID for confirmation"}
                </button>
              </div>
              <p className="mt-4 mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                {method === "pesapal"
                  ? "Secured by Pesapal. You'll receive your QR ticket by email."
                  : "Tickets issue after we confirm the TID against our merchant statement."}
              </p>
              </>
              )}
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
