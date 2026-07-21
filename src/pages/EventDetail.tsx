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
  policy: string | null;
  age_limit: number | null;
  pesapal_enabled: boolean;
  manual_enabled: boolean;
  gallery: string[] | null;
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

type TierState = { open: boolean; label: string; tone: "open" | "soon" | "closed" | "sold" };

function tierWindowState(t: Tier, available: number): TierState {
  const now = Date.now();
  if (available <= 0) return { open: false, label: "Sold out", tone: "sold" };
  if (t.sales_start_at && new Date(t.sales_start_at).getTime() > now)
    return { open: false, label: `Opens ${new Date(t.sales_start_at).toLocaleString()}`, tone: "soon" };
  if (t.sales_end_at && new Date(t.sales_end_at).getTime() < now)
    return { open: false, label: "Sales closed", tone: "closed" };
  if (t.sales_end_at)
    return { open: true, label: `On sale · closes ${new Date(t.sales_end_at).toLocaleString()}`, tone: "open" };
  return { open: true, label: "On sale", tone: "open" };
}

const toneClass: Record<TierState["tone"], string> = {
  open: "bg-site-red/10 text-site-red border-site-red/40",
  soon: "bg-yellow-500/10 text-yellow-500 border-yellow-500/40",
  closed: "bg-muted text-muted-foreground border-border",
  sold: "bg-foreground text-background border-foreground",
};

type Tab = "about" | "tickets" | "policies" | "gallery";

export default function EventDetail() {
  const { slug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [shakeTier, setShakeTier] = useState<string | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "", age: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"pesapal" | "manual">("pesapal");
  const [manualProvider, setManualProvider] = useState<"momo" | "airtel">("momo");
  const [tid, setTid] = useState("");
  const [manualDone, setManualDone] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("about");

  useEffect(() => {
    (async () => {
      const isUuid = !!slug && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const q = supabase.from("events").select("*").eq("published", true);
      const { data: e } = await (isUuid ? q.eq("id", slug) : q.eq("slug", slug)).maybeSingle();
      setEvent(e as Event | null);
      if (e) {
        const eid = (e as any).id as string;
        const { data: t } = await supabase.from("ticket_tiers").select("*").eq("event_id", eid).order("sort");
        setTiers((t as Tier[]) || []);
        const { data: av } = await supabase.rpc("tier_available_counts", { _event_id: eid });
        const map: Record<string, number> = {};
        (av as any[] || []).forEach((r) => { map[r.tier_id] = r.available; });
        setAvailable(map);
        // default method preference based on what's open
        if ((e as any).pesapal_enabled === false && (e as any).manual_enabled !== false) setMethod("manual");
      }
      setLoading(false);
    })();
  }, [slug]);

  const total = useMemo(
    () => tiers.reduce((sum, t) => sum + (qty[t.id] || 0) * t.price_ugx, 0),
    [tiers, qty]
  );
  const totalQty = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty]);

  const bump = (tierId: string, delta: number) => {
    const cur = qty[tierId] || 0;
    const max = Math.min(20, available[tierId] ?? 20);
    const next = Math.max(0, Math.min(max, cur + delta));
    if (delta > 0 && next === cur) {
      // hit the ceiling
      setShakeTier(tierId);
      const remaining = available[tierId] ?? 0;
      toast.error(remaining <= 0 ? "Sold out" : `Only ${remaining} available`);
      setTimeout(() => setShakeTier(null), 500);
      return;
    }
    setQty({ ...qty, [tierId]: next });
  };

  const validate = () => {
    if (totalQty === 0) return "Select at least one ticket";
    if (!buyer.name || !buyer.email || !buyer.phone) return "Fill in all buyer details";
    if (!/^\+?\d{9,15}$/.test(buyer.phone.replace(/\s/g, ""))) return "Enter a valid phone number";
    if (event?.age_limit) {
      const age = Number(buyer.age);
      if (!age || age < event.age_limit) return `You must be ${event.age_limit}+ to buy tickets for this event`;
    }
    return null;
  };

  const items = () => Object.entries(qty).filter(([, q]) => q > 0).map(([tierId, quantity]) => ({ tierId, quantity }));

  const checkoutPesapal = async () => {
    if (!event) return;
    if (event.pesapal_enabled === false) return toast.error("Pesapal is currently closed for this event");
    const err = validate();
    if (err) return toast.error(err);
    setSubmitting(true);
    try {
      const returnUrl = `${window.location.origin}/tickets/thank-you`;
      const { data, error } = await supabase.functions.invoke("pesapal-checkout", {
        body: { eventId: event.id, items: items(), buyer: { ...buyer, age: Number(buyer.age) || null }, returnUrl },
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
    if (event.manual_enabled === false) return toast.error("Manual payment is closed for this event");
    const err = validate();
    if (err) return toast.error(err);
    if (!tid || tid.trim().length < 4) return toast.error("Enter the TID from your payment confirmation SMS");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manual-checkout", {
        body: { eventId: event.id, items: items(), buyer: { ...buyer, age: Number(buyer.age) || null }, tid: tid.trim(), provider: manualProvider },
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

  const pesapalClosed = event?.pesapal_enabled === false;
  const manualClosed = event?.manual_enabled === false;

  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: "about", label: "About", visible: true },
    { key: "tickets", label: "Tickets", visible: true },
    { key: "policies", label: "Policies", visible: !!event?.policy },
    { key: "gallery", label: "Gallery", visible: !!(event?.gallery && event.gallery.length) },
  ];

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
          <>
            {/* Header */}
            <div className="grid lg:grid-cols-2 gap-16 mb-12">
              <div>
                {event.cover_url && (
                  <img src={event.cover_url} alt={event.title} className="w-full rounded-lg" loading="lazy" decoding="async" />
                )}
              </div>
              <div>
                <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">
                  {new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                </div>
                <h1 className="display text-5xl md:text-7xl mt-3 leading-none">{event.title}</h1>
                {event.venue && <p className="mt-3 text-lg text-muted-foreground">{event.venue}</p>}
                {event.age_limit && (
                  <div className="mt-4 inline-flex items-center gap-2 border border-site-red text-site-red px-3 py-1 rounded-full mono text-[10px] uppercase tracking-[0.3em]">
                    {event.age_limit}+ Only
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border flex gap-8 overflow-x-auto scrollbar-none">
              {tabs.filter((t) => t.visible).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pb-3 mono text-xs uppercase tracking-[0.3em] border-b-2 transition-colors ${tab === t.key ? "border-site-red text-site-red" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-hover
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-10">
              {tab === "about" && (
                <div className="max-w-3xl space-y-8">
                  {event.description ? (
                    <p className="whitespace-pre-line text-lg leading-relaxed">{event.description}</p>
                  ) : (
                    <p className="mono text-xs text-muted-foreground">No description yet.</p>
                  )}
                  {(event as any).organizer_name && (
                    <div className="border-t border-border pt-6">
                      <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Organized by</p>
                      <p className="display text-2xl mt-2">{(event as any).organizer_name}</p>
                      {Array.isArray((event as any).organizer_socials) && (event as any).organizer_socials.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-3">
                          {(event as any).organizer_socials.map((s: any, i: number) => (
                            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mono text-xs uppercase tracking-[0.2em] border border-border rounded-full px-3 py-1 hover:border-site-red hover:text-site-red" data-hover>
                              {s.label || s.url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === "policies" && event.policy && (
                <div className="max-w-3xl">
                  <p className="whitespace-pre-line leading-relaxed">{event.policy}</p>
                </div>
              )}

              {tab === "gallery" && event.gallery && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {event.gallery.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`${event.title} gallery ${i + 1}`} loading="lazy" className="w-full h-64 object-cover rounded-lg hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}

              {tab === "tickets" && (
                <div className="grid lg:grid-cols-2 gap-16">
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
                        <h2 className="display text-3xl mb-6">Choose your tickets</h2>
                        <div className="space-y-3">
                          {tiers.map((t) => {
                            const remaining = available[t.id] ?? t.capacity;
                            const ws = tierWindowState(t, remaining);
                            const isShaking = shakeTier === t.id;
                            return (
                              <div
                                key={t.id}
                                className={`border rounded-lg p-5 ${!ws.open ? "opacity-70" : ""} ${isShaking ? "shake border-site-red" : "border-border"}`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="display text-xl">{t.name}</div>
                                    <div className="mono text-xs text-muted-foreground">{ugx(t.price_ugx)}</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className={`mono text-[10px] uppercase tracking-[0.2em] border px-2 py-0.5 rounded-full ${toneClass[ws.tone]}`}>
                                        {ws.label}
                                      </span>
                                      {ws.open && (
                                        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                          {remaining} available
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      disabled={!ws.open}
                                      onClick={() => bump(t.id, -1)}
                                      className="w-9 h-9 rounded-full border border-border hover:border-site-red disabled:opacity-30"
                                      data-hover
                                      aria-label={`Remove one ${t.name} ticket`}
                                    >−</button>
                                    <span className="mono w-6 text-center">{qty[t.id] || 0}</span>
                                    <button
                                      disabled={!ws.open}
                                      onClick={() => bump(t.id, 1)}
                                      className="w-9 h-9 rounded-full border border-border hover:border-site-red disabled:opacity-30"
                                      data-hover
                                      aria-label={`Add one ${t.name} ticket`}
                                    >+</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {!tiers.length && <p className="mono text-xs opacity-60">No tiers set for this event yet.</p>}
                        </div>
                      </>
                    )}
                  </div>

                  {!manualDone && (
                    <div>
                      <h2 className="display text-3xl mb-6">Your details</h2>
                      <div className="space-y-4">
                        <label className="block">
                          <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Full name</span>
                          <input required placeholder="Jane Doe" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className="mt-1 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2" />
                        </label>
                        <label className="block">
                          <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Email</span>
                          <input required type="email" placeholder="you@email.com" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className="mt-1 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2" />
                        </label>
                        <label className="block">
                          <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Phone</span>
                          <input required placeholder="256772000000" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className="mt-1 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2" />
                        </label>
                        <label className="block">
                          <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                            Age {event.age_limit ? <span className="text-site-red">(must be {event.age_limit}+)</span> : "(optional)"}
                          </span>
                          <input type="number" min={1} max={120} placeholder="e.g. 22" value={buyer.age} onChange={(e) => setBuyer({ ...buyer, age: e.target.value })} className="mt-1 w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2" />
                        </label>
                      </div>

                      {/* Payment method */}
                      <div className="mt-8">
                        <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Payment method</div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={pesapalClosed}
                            onClick={() => !pesapalClosed && setMethod("pesapal")}
                            className={`border rounded-lg p-4 text-left transition-colors ${method === "pesapal" && !pesapalClosed ? "border-site-red" : "border-border"} ${pesapalClosed ? "opacity-50 cursor-not-allowed" : ""}`}
                            data-hover
                          >
                            <div className="flex items-center gap-2">
                              <div className="display text-lg">Pesapal</div>
                              {pesapalClosed && <span className="mono text-[9px] uppercase tracking-[0.2em] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>}
                            </div>
                            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                              {pesapalClosed ? "Temporarily unavailable" : "Auto · MoMo / Airtel / Card"}
                            </div>
                          </button>
                          <button
                            type="button"
                            disabled={manualClosed}
                            onClick={() => !manualClosed && setMethod("manual")}
                            className={`border rounded-lg p-4 text-left transition-colors ${method === "manual" && !manualClosed ? "border-site-red" : "border-border"} ${manualClosed ? "opacity-50 cursor-not-allowed" : ""}`}
                            data-hover
                          >
                            <div className="flex items-center gap-2">
                              <div className="display text-lg">Manual TID</div>
                              {manualClosed && <span className="mono text-[9px] uppercase tracking-[0.2em] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>}
                            </div>
                            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                              {manualClosed ? "Temporarily unavailable" : "Pay first · Submit SMS TID"}
                            </div>
                          </button>
                        </div>
                      </div>

                      {method === "manual" && !manualClosed && (
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
                          disabled={submitting || total === 0 || (method === "pesapal" && pesapalClosed) || (method === "manual" && manualClosed)}
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
