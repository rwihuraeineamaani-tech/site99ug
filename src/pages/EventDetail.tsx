import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
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
  ends_at?: string | null;
  cover_url: string | null;
  poster_url?: string | null;
  momo_number: string | null;
  airtel_number: string | null;
  policy: string | null;
  age_limit: number | null;
  pesapal_enabled: boolean;
  manual_enabled: boolean;
  gallery: string[] | null;
  organizer_name?: string | null;
  organizer_socials?: { label?: string; url: string }[] | null;
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

const DEFAULT_POLICY =
  "Standard Site 99 event terms apply.\n\n• Tickets are non-refundable once issued.\n• Valid QR ticket required at the gate.\n• Right of admission reserved.\n• No re-entry unless stamped by security.";

function icsFor(event: Event) {
  const dt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 3 * 3600 * 1000);
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Site99//Events//EN", "BEGIN:VEVENT",
    `UID:${event.id}@site99ug.com`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    `SUMMARY:${esc(event.title)}`,
    event.venue ? `LOCATION:${esc(event.venue)}` : "",
    event.description ? `DESCRIPTION:${esc(event.description)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return ics;
}

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
      setEvent(e as unknown as Event | null);
      if (e) {
        const eid = (e as any).id as string;
        const { data: t } = await supabase.from("ticket_tiers").select("*").eq("event_id", eid).order("sort");
        setTiers((t as Tier[]) || []);
        const { data: av } = await supabase.rpc("tier_available_counts", { _event_id: eid });
        const map: Record<string, number> = {};
        (av as any[] || []).forEach((r) => { map[r.tier_id] = r.available; });
        setAvailable(map);
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

  const goTickets = () => {
    setTab("tickets");
    setTimeout(() => document.getElementById("tabs-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: event?.title, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const downloadIcs = () => {
    if (!event) return;
    const blob = new Blob([icsFor(event)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug || event.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "about", label: "About" },
    { key: "tickets", label: "Tickets" },
    { key: "policies", label: "Policies" },
    { key: "gallery", label: "Gallery" },
  ];

  const startDate = event ? new Date(event.starts_at) : null;

  return (
    <Layout>
      <Seo
        title={`${event?.title || "Event"} — Site 99 Tickets`}
        description={event?.description?.slice(0, 155) || "Buy tickets with MoMo or Airtel Money."}
        path={`/events/${slug}`}
      />

      {loading && <section className="pt-32 px-8 md:px-16"><p className="mono text-xs">Loading…</p></section>}
      {!loading && !event && <section className="pt-32 px-8 md:px-16"><p className="mono text-xs">Event not found.</p></section>}

      {event && (
        <>
          {/* HERO */}
          <section className="relative pt-24 md:pt-28">
            {event.poster_url ? (
              // POSTER MODE — clean, no fade over the artwork
              <div className="relative w-full overflow-hidden">
                {/* optional ambient backdrop from cover_url, heavily blurred so it doesn't fight the poster */}
                {event.cover_url && (
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-center bg-cover scale-110 blur-3xl opacity-40"
                    style={{ backgroundImage: `url(${event.cover_url})` }}
                  />
                )}
                <div className="absolute inset-0 bg-background/60" />
                <div className="relative px-8 md:px-16 py-10 md:py-16 grid md:grid-cols-[minmax(0,420px)_1fr] gap-10 md:gap-14 items-center">
                  <motion.img
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    src={event.poster_url}
                    alt={`${event.title} poster`}
                    loading="eager"
                    decoding="async"
                    className="w-full max-w-[420px] mx-auto md:mx-0 rounded-lg shadow-2xl object-contain"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">
                      {startDate?.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                    </div>
                    <h1 className="display text-4xl md:text-7xl mt-3 leading-[0.9]">{event.title}</h1>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {event.venue && (
                        <span className="mono text-[10px] uppercase tracking-[0.3em] border border-border rounded-full px-3 py-1">
                          {event.venue}
                        </span>
                      )}
                      {event.age_limit && (
                        <span className="mono text-[10px] uppercase tracking-[0.3em] border border-site-red text-site-red rounded-full px-3 py-1">
                          {event.age_limit}+ Only
                        </span>
                      )}
                      <button
                        onClick={() => { setTab("policies"); document.getElementById("tabs-anchor")?.scrollIntoView({ behavior: "smooth" }); }}
                        className="mono text-[10px] uppercase tracking-[0.3em] border border-border rounded-full px-3 py-1 hover:border-site-red hover:text-site-red transition-colors"
                        data-hover
                      >
                        Policies
                      </button>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        onClick={goTickets}
                        className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors"
                        data-hover
                      >
                        Get tickets
                      </button>
                      <button onClick={downloadIcs} className="mono text-xs uppercase tracking-[0.25em] border border-border rounded-full px-5 py-3 hover:border-site-red" data-hover>
                        Add to calendar
                      </button>
                      <button onClick={share} className="mono text-xs uppercase tracking-[0.25em] border border-border rounded-full px-5 py-3 hover:border-site-red" data-hover>
                        Share
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            ) : (
              // COVER MODE — atmospheric fade
              <div className="relative h-[62vh] min-h-[420px] max-h-[720px] w-full overflow-hidden">
                {event.cover_url ? (
                  <img
                    src={event.cover_url}
                    alt={event.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-site-red/40 via-background to-background" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />

                <div className="relative h-full flex flex-col justify-end px-8 md:px-16 pb-10 md:pb-16">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-5xl"
                  >
                    <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">
                      {startDate?.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                    </div>
                    <h1 className="display text-5xl md:text-8xl mt-3 leading-[0.9]">{event.title}</h1>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {event.venue && (
                        <span className="mono text-[10px] uppercase tracking-[0.3em] border border-border rounded-full px-3 py-1">
                          {event.venue}
                        </span>
                      )}
                      {event.age_limit && (
                        <span className="mono text-[10px] uppercase tracking-[0.3em] border border-site-red text-site-red rounded-full px-3 py-1">
                          {event.age_limit}+ Only
                        </span>
                      )}
                      <button
                        onClick={() => { setTab("policies"); document.getElementById("tabs-anchor")?.scrollIntoView({ behavior: "smooth" }); }}
                        className="mono text-[10px] uppercase tracking-[0.3em] border border-border rounded-full px-3 py-1 hover:border-site-red hover:text-site-red transition-colors"
                        data-hover
                      >
                        Policies
                      </button>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        onClick={goTickets}
                        className="bg-site-red text-site-white px-8 py-4 rounded-full label text-xs hover:bg-foreground hover:text-background transition-colors"
                        data-hover
                      >
                        Get tickets
                      </button>
                      <button onClick={downloadIcs} className="mono text-xs uppercase tracking-[0.25em] border border-border rounded-full px-5 py-3 hover:border-site-red" data-hover>
                        Add to calendar
                      </button>
                      <button onClick={share} className="mono text-xs uppercase tracking-[0.25em] border border-border rounded-full px-5 py-3 hover:border-site-red" data-hover>
                        Share
                      </button>

                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* INFO STRIP */}
          <section className="px-8 md:px-16 border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8">
              {[
                { k: "Date", v: startDate?.toLocaleDateString(undefined, { dateStyle: "medium" }) || "TBA" },
                { k: "Doors", v: startDate?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) || "TBA" },
                { k: "Venue", v: event.venue || "TBA" },
                { k: "Age", v: event.age_limit ? `${event.age_limit}+` : "All ages" },
              ].map((m) => (
                <div key={m.k}>
                  <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{m.k}</div>
                  <div className="mt-1 text-base md:text-lg">{m.v}</div>
                </div>
              ))}
            </div>
          </section>

          {/* TABS */}
          <div id="tabs-anchor" />
          <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
            <div className="px-8 md:px-16 flex gap-8 overflow-x-auto scrollbar-none">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-4 mono text-xs uppercase tracking-[0.3em] border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? "border-site-red text-site-red" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-hover
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <section className="px-8 md:px-16 py-12 pb-32 md:pb-16">
            {tab === "about" && (
              <div className="grid md:grid-cols-3 gap-12">
                <div className="md:col-span-2 space-y-6">
                  {event.description ? (
                    <p className="whitespace-pre-line text-lg leading-relaxed">{event.description}</p>
                  ) : (
                    <p className="mono text-xs text-muted-foreground">No description yet.</p>
                  )}
                </div>
                <aside className="space-y-6">
                  {event.organizer_name && (
                    <div className="border border-border rounded-lg p-6">
                      <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Organized by</div>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="w-12 h-12 rounded-full bg-site-red text-site-white flex items-center justify-center display text-xl">
                          {event.organizer_name.charAt(0)}
                        </div>
                        <div className="display text-xl leading-tight">{event.organizer_name}</div>
                      </div>
                      {Array.isArray(event.organizer_socials) && event.organizer_socials.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {event.organizer_socials.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mono text-[10px] uppercase tracking-[0.2em] border border-border rounded-full px-3 py-1 hover:border-site-red hover:text-site-red" data-hover>
                              {s.label || s.url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="border border-border rounded-lg p-6 space-y-2 mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <div>Secured checkout</div>
                    <div>MoMo · Airtel · Card</div>
                    <div>QR ticket by email</div>
                    <div className="normal-case tracking-normal text-foreground">office@site99ug.com</div>
                  </div>
                </aside>
              </div>
            )}

            {tab === "policies" && (
              <div className="max-w-3xl">
                <h2 className="display text-3xl mb-6">Policies & terms</h2>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {event.policy || DEFAULT_POLICY}
                </p>
              </div>
            )}

            {tab === "gallery" && (
              event.gallery && event.gallery.length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {event.gallery.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                      <img src={url} alt={`${event.title} gallery ${i + 1}`} loading="lazy" className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mono text-xs text-muted-foreground">No gallery images yet.</p>
              )
            )}

            {tab === "tickets" && (
              <div className="grid lg:grid-cols-5 gap-10">
                {/* LEFT: tiers */}
                <div className="lg:col-span-3">
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
                          const pct = Math.max(4, Math.min(100, (remaining / Math.max(1, t.capacity)) * 100));
                          return (
                            <div
                              key={t.id}
                              className={`border rounded-lg p-5 transition-colors ${!ws.open ? "opacity-70" : ""} ${isShaking ? "shake border-site-red" : (qty[t.id] ? "border-site-red" : "border-border")}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="display text-xl">{t.name}</div>
                                  <div className="mono text-xs text-muted-foreground">{ugx(t.price_ugx)}</div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className={`mono text-[10px] uppercase tracking-[0.2em] border px-2 py-0.5 rounded-full ${toneClass[ws.tone]}`}>
                                      {ws.label}
                                    </span>
                                    {ws.open && (
                                      <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        {remaining} left
                                      </span>
                                    )}
                                  </div>
                                  {ws.open && (
                                    <div className="mt-3 h-1 w-full bg-border rounded-full overflow-hidden">
                                      <div className="h-full bg-site-red" style={{ width: `${pct}%` }} />
                                    </div>
                                  )}
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

                {/* RIGHT: sticky summary + buyer */}
                {!manualDone && (
                  <div className="lg:col-span-2">
                    <div className="lg:sticky lg:top-20 border border-border rounded-lg p-6 space-y-6 bg-background">
                      <div>
                        <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Order summary</div>
                        <div className="mt-3 space-y-1 text-sm">
                          {items().length === 0 && <div className="text-muted-foreground">No tickets selected</div>}
                          {items().map(({ tierId, quantity }) => {
                            const t = tiers.find((x) => x.id === tierId);
                            if (!t) return null;
                            return (
                              <div key={tierId} className="flex justify-between">
                                <span>{quantity} × {t.name}</span>
                                <span className="mono">{ugx(quantity * t.price_ugx)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between">
                          <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Total</span>
                          <span className="display text-3xl">{ugx(total)}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
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

                      <div>
                        <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Payment method</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={pesapalClosed}
                            onClick={() => !pesapalClosed && setMethod("pesapal")}
                            className={`border rounded-lg p-3 text-left transition-colors ${method === "pesapal" && !pesapalClosed ? "border-site-red" : "border-border"} ${pesapalClosed ? "opacity-50 cursor-not-allowed" : ""}`}
                            data-hover
                          >
                            <div className="flex items-center gap-2">
                              <div className="display text-base">Pesapal</div>
                              {pesapalClosed && <span className="mono text-[9px] uppercase tracking-[0.2em] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>}
                            </div>
                            <div className="mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                              {pesapalClosed ? "Unavailable" : "Auto · Card / MoMo"}
                            </div>
                          </button>
                          <button
                            type="button"
                            disabled={manualClosed}
                            onClick={() => !manualClosed && setMethod("manual")}
                            className={`border rounded-lg p-3 text-left transition-colors ${method === "manual" && !manualClosed ? "border-site-red" : "border-border"} ${manualClosed ? "opacity-50 cursor-not-allowed" : ""}`}
                            data-hover
                          >
                            <div className="flex items-center gap-2">
                              <div className="display text-base">Manual TID</div>
                              {manualClosed && <span className="mono text-[9px] uppercase tracking-[0.2em] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>}
                            </div>
                            <div className="mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                              {manualClosed ? "Unavailable" : "Pay first · Submit TID"}
                            </div>
                          </button>
                        </div>
                      </div>

                      {method === "manual" && !manualClosed && (
                        <div className="border border-border rounded-lg p-4 space-y-3">
                          <div className="flex gap-2">
                            {(["momo", "airtel"] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setManualProvider(p)}
                                className={`px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.2em] border ${manualProvider === p ? "border-site-red text-site-red" : "border-border"}`}
                                data-hover
                              >
                                {p === "momo" ? "MTN MoMo" : "Airtel Money"}
                              </button>
                            ))}
                          </div>
                          <div className="mono text-xs text-muted-foreground leading-relaxed">
                            <div>1. Dial <span className="text-foreground">{payLabel.code}</span> and send <span className="text-foreground">{ugx(total || 0)}</span> to</div>
                            <div className="display text-xl text-foreground mt-1">{payLabel.number}</div>
                            <div className="mt-2">2. Paste the TID from the SMS below.</div>
                          </div>
                          <input
                            placeholder="Transaction ID"
                            value={tid}
                            onChange={(e) => setTid(e.target.value)}
                            className="w-full bg-transparent border-b border-border focus:border-site-red outline-none py-2 mono text-sm"
                          />
                        </div>
                      )}

                      <button
                        onClick={method === "pesapal" ? checkoutPesapal : checkoutManual}
                        disabled={submitting || total === 0 || (method === "pesapal" && pesapalClosed) || (method === "manual" && manualClosed)}
                        data-hover
                        className="w-full bg-site-red text-site-white px-6 py-4 rounded-full label text-xs disabled:opacity-50 hover:bg-foreground hover:text-background transition-colors"
                      >
                        {submitting
                          ? method === "pesapal" ? "Opening Pesapal…" : "Submitting…"
                          : method === "pesapal" ? `Pay ${ugx(total)} with Pesapal` : `Submit TID · ${ugx(total)}`}
                      </button>
                      <p className="mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] text-center">
                        {method === "pesapal"
                          ? "Secured by Pesapal. QR ticket by email."
                          : "Ticket issues after TID is verified."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* MOBILE STICKY CTA */}
          {tab !== "tickets" && (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">From</div>
                <div className="display text-lg leading-none">
                  {tiers.length ? ugx(Math.min(...tiers.map((t) => t.price_ugx))) : "—"}
                </div>
              </div>
              <button
                onClick={goTickets}
                className="bg-site-red text-site-white px-6 py-3 rounded-full label text-xs"
                data-hover
              >
                Get tickets
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
