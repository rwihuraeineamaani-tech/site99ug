import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const DEFAULT_TEMPLATE_FIELDS = {
  fields: [
    { type: "text", key: "event_title", x: 40, y: 300, size: 22 },
    { type: "text", key: "tier_name", x: 40, y: 270, size: 14, color: "#c1272d" },
    { type: "text", key: "holder_name", x: 40, y: 235, size: 16 },
    { type: "text", key: "starts_at", x: 40, y: 205, size: 11 },
    { type: "text", key: "venue", x: 40, y: 185, size: 11 },
    { type: "text", key: "order_ref", x: 40, y: 155, size: 9, color: "#666666" },
    { type: "text", key: "ticket_id", x: 40, y: 140, size: 9, color: "#666666" },
    { type: "qr", x: 420, y: 130, size: 170 },
  ],
};

const empty: any = {
  slug: "",
  title: "",
  description: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  cover_url: "",
  poster_url: "",
  momo_number: "",
  airtel_number: "",
  policy: "",
  age_limit: "",
  pesapal_enabled: true,
  manual_enabled: true,
  gallery: [] as string[],
  organizer_name: "",
  organizer_socials: [] as { label: string; url: string }[],
  ticket_template_url: "",
  ticket_template_fields: DEFAULT_TEMPLATE_FIELDS,
  sender_from_name: "Site 99 Tickets",
  sender_from_email: "office@site99ug.com",
  published: false,
};

const emptyTier = { name: "", price_ugx: 0, capacity: 100, sales_start_at: "", sales_end_at: "" };

type AdminTab = "dashboard" | "manager" | "buyers" | "trashed";

export default function EventsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<AdminTab>("dashboard");

  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierEventId, setTierEventId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierForm, setTierForm] = useState<any>(emptyTier);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [trashed, setTrashed] = useState<any[]>([]);

  // Buyers search
  const [query, setQuery] = useState("");
  const [scopeEventId, setScopeEventId] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("project-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadCover = async (file: File) => {
    const url = await uploadImage(file);
    if (url) { setForm((f: any) => ({ ...f, cover_url: url })); toast.success("Cover uploaded"); }
  };

  const uploadPoster = async (file: File) => {
    const url = await uploadImage(file);
    if (url) { setForm((f: any) => ({ ...f, poster_url: url })); toast.success("Poster uploaded"); }
  };


  const uploadGallery = async (files: FileList) => {
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const u = await uploadImage(f);
      if (u) urls.push(u);
    }
    if (urls.length) {
      setForm((f: any) => ({ ...f, gallery: [...(f.gallery || []), ...urls] }));
      toast.success(`${urls.length} image(s) added`);
    }
  };

  const uploadTemplatePdf = async (file: File) => {
    if (file.type !== "application/pdf") return toast.error("PDF only");
    setUploading(true);
    try {
      const path = `templates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error } = await supabase.storage.from("ticket-templates").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (error) throw error;
      setForm((f: any) => ({ ...f, ticket_template_url: path }));
      toast.success("Template uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendTickets = async (orderId: string) => {
    const t = toast.loading("Generating & sending tickets…");
    const { data, error } = await supabase.functions.invoke("send-ticket-email", { body: { orderId } });
    toast.dismiss(t);
    if (error || !data?.ok) {
      const details = (data as any)?.error || (error as any)?.message || "Send failed";
      return toast.error(details);
    }
    toast.success(`Sent ${data.count} ticket(s) to ${data.sent_to}`);
    loadPending();
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getUser();
      if (!s.user) return setIsAdmin(false);
      const { data: r } = await supabase.rpc("has_role", { _user_id: s.user.id, _role: "admin" });
      setIsAdmin(!!r);
      if (r) {
        load();
        loadPending();
      }
    })();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
    setEvents(data || []);
  };

  const loadPending = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, buyer_name, buyer_email, buyer_phone, amount_ugx, manual_tid, manual_provider, status, created_at, pesapal_merchant_reference, event_id, deleted_at, events(title)")
      .eq("payment_method", "manual")
      .in("status", ["pending", "paid", "rejected"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    setPending(data || []);
  };

  const loadTrashed = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, buyer_name, buyer_email, buyer_phone, amount_ugx, manual_tid, manual_provider, payment_method, status, created_at, deleted_at, pesapal_merchant_reference, event_id, events(title)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    setTrashed(data || []);
  };

  const trashOrder = async (o: any) => {
    if (!confirm(`Move this order to trash?\n\n${o.buyer_name} · UGX ${Number(o.amount_ugx || 0).toLocaleString()}\n\nTickets will stop working at the gate. You can restore it from the Trashed tab.`)) return;
    const { error } = await supabase.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Order moved to trash");
    loadPending();
    if (tab === "buyers") runSearch();
    if (tab === "trashed") loadTrashed();
  };

  const restoreOrder = async (o: any) => {
    const { error } = await supabase.from("orders").update({ deleted_at: null }).eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Order restored");
    loadTrashed();
    loadPending();
  };

  const loadTiers = async (eventId: string) => {
    const { data } = await supabase.from("ticket_tiers").select("*").eq("event_id", eventId).order("sort");
    setTiers(data || []);
    setTierEventId(eventId);
  };

  const save = async () => {
    const payload: any = {
      ...form,
      ends_at: form.ends_at || null,
      age_limit: form.age_limit ? Number(form.age_limit) : null,
      policy: form.policy || null,
      gallery: form.gallery || [],
      organizer_name: form.organizer_name || null,
      organizer_socials: form.organizer_socials || [],
      ticket_template_url: form.ticket_template_url || null,
      ticket_template_fields: form.ticket_template_fields || DEFAULT_TEMPLATE_FIELDS,
      sender_from_name: form.sender_from_name || "Site 99 Tickets",
      sender_from_email: form.sender_from_email || "office@site99ug.com",
    };
    if (editingId) {
      const { error } = await supabase.from("events").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Created");
    }
    setForm(empty);
    setEditingId(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addTier = async () => {
    if (!tierEventId) return;
    const payload: any = {
      name: tierForm.name,
      price_ugx: Number(tierForm.price_ugx),
      capacity: Number(tierForm.capacity),
      event_id: tierEventId,
      sort: tiers.length,
      sales_start_at: tierForm.sales_start_at || null,
      sales_end_at: tierForm.sales_end_at || null,
    };
    const { error } = await supabase.from("ticket_tiers").insert(payload);
    if (error) return toast.error(error.message);
    setTierForm(emptyTier);
    loadTiers(tierEventId);
  };

  const delTier = async (id: string) => {
    await supabase.from("ticket_tiers").delete().eq("id", id);
    if (tierEventId) loadTiers(tierEventId);
  };

  const confirmOrder = async (o: any) => {
    if (!confirm(`Confirm payment of UGX ${o.amount_ugx.toLocaleString()} from ${o.buyer_name} (TID ${o.manual_tid})?\n\nTickets will be generated and emailed to ${o.buyer_email}.`)) return;
    const { data: s } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), manual_confirmed_by: s.user?.id, manual_confirmed_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) return toast.error(error.message);
    await supabase.from("tickets").update({ status: "valid" }).eq("order_id", o.id);
    toast.success("Confirmed — tickets are live");
    await sendTickets(o.id);
  };

  const rejectOrder = async (o: any) => {
    if (!confirm(`Reject this order (TID ${o.manual_tid})? Tickets will be voided.`)) return;
    const { error } = await supabase.from("orders").update({ status: "rejected" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    await supabase.from("tickets").update({ status: "void" }).eq("order_id", o.id);
    toast.success("Rejected");
    loadPending();
  };

  const runSearch = async () => {
    if (!query || query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data, error } = await supabase.rpc("admin_search_orders", {
      _q: query.trim(),
      _event_id: scopeEventId || null,
      _limit: 50,
    });
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults(data || []);
  };

  useEffect(() => {
    const t = setTimeout(runSearch, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, scopeEventId]);

  const exportCsv = async (eventId?: string) => {
    const q = supabase
      .from("orders")
      .select("id, buyer_name, buyer_email, buyer_phone, buyer_age, amount_ugx, status, payment_method, manual_provider, manual_tid, pesapal_merchant_reference, created_at, paid_at, event_id, events(title), tickets(id, holder_name, tier_id, ticket_tiers(name))")
      .in("status", ["paid", "pending"])
      .order("created_at", { ascending: false })
      .limit(5000);
    const { data, error } = eventId ? await q.eq("event_id", eventId) : await q;
    if (error) return toast.error(error.message);
    const rows = (data || []).flatMap((o: any) => {
      const tks = o.tickets?.length ? o.tickets : [{ id: "", holder_name: "", ticket_tiers: { name: "" } }];
      return tks.map((t: any) => ({
        event: o.events?.title || "",
        order_ref: o.pesapal_merchant_reference,
        status: o.status,
        method: o.payment_method,
        provider: o.manual_provider || "",
        tid: o.manual_tid || "",
        buyer_name: o.buyer_name,
        buyer_email: o.buyer_email,
        buyer_phone: o.buyer_phone,
        buyer_age: o.buyer_age ?? "",
        amount_ugx: o.amount_ugx,
        tier: t.ticket_tiers?.name || "",
        holder: t.holder_name || "",
        ticket_id: t.id || "",
        created_at: o.created_at,
        paid_at: o.paid_at || "",
      }));
    });
    if (!rows.length) return toast.error("No orders to export");
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site99-buyers-${eventId || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = pending.filter((p) => p.status === "pending").length;

  const stats = useMemo(() => {
    const paidOrders = pending.filter((p) => p.status === "paid");
    const revenue = paidOrders.reduce((s, o) => s + (o.amount_ugx || 0), 0);
    return { live: events.filter((e) => e.published).length, drafts: events.filter((e) => !e.published).length, pendingCount, paidCount: paidOrders.length, revenue };
  }, [events, pending, pendingCount]);

  if (isAdmin === null) return <Layout><p className="p-16">Loading…</p></Layout>;
  if (!isAdmin) return <Layout><div className="p-16"><p>Admin only. <Link to="/admin/login" className="underline">Sign in</Link></p></div></Layout>;

  return (
    <Layout>
      <Seo title="Events Admin — Site 99" description="Manage events" path="/admin/events" />
      <section className="pt-28 pb-16 px-8 md:px-16">
        <div className="flex justify-between items-baseline gap-6 flex-wrap">
          <div>
            <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Admin</div>
            <h1 className="display text-5xl mt-2">Events</h1>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={() => exportCsv()} className="mono text-xs uppercase tracking-[0.2em] border border-border px-4 py-2 rounded-full" data-hover>Export all buyers</button>
            <Link to="/admin/scan" className="mono text-xs uppercase tracking-[0.2em] border border-site-red px-4 py-2 rounded-full" data-hover>
              Open Scanner →
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-border flex gap-8 flex-wrap">
          {([
            ["dashboard", "Dashboard"],
            ["manager", "Event Manager"],
            ["buyers", "Buyers Search"],
            ["trashed", "Trashed"],
          ] as [AdminTab, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setTab(k); if (k === "trashed") loadTrashed(); }}
              className={`pb-3 mono text-xs uppercase tracking-[0.3em] border-b-2 transition-colors ${tab === k ? "border-site-red text-site-red" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-hover
            >
              {l}{k === "dashboard" && pendingCount > 0 && <span className="ml-2 text-site-red">({pendingCount})</span>}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Live events", stats.live],
                ["Drafts", stats.drafts],
                ["Pending TID", stats.pendingCount],
                ["Manual revenue", `UGX ${stats.revenue.toLocaleString()}`],
              ].map(([l, v]) => (
                <div key={l as string} className="border border-border rounded-lg p-5">
                  <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{l}</div>
                  <div className="display text-3xl mt-2">{v as any}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 border border-site-red rounded-lg p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="display text-2xl">Manual TID confirmations {pendingCount > 0 && <span className="mono text-xs text-site-red ml-2">({pendingCount} pending)</span>}</h2>
                <button onClick={loadPending} className="mono text-[10px] uppercase tracking-[0.2em] opacity-60 hover:opacity-100" data-hover>Refresh</button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-left">
                    <tr><th className="py-2 pr-4">When</th><th className="pr-4">Event</th><th className="pr-4">Buyer</th><th className="pr-4">Provider</th><th className="pr-4">TID</th><th className="pr-4">Amount</th><th className="pr-4">Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pending.map((o) => (
                      <tr key={o.id} className="border-t border-border align-top">
                        <td className="py-3 pr-4 mono text-xs">{new Date(o.created_at).toLocaleString()}</td>
                        <td className="pr-4">{o.events?.title || "—"}</td>
                        <td className="pr-4">
                          <div>{o.buyer_name}</div>
                          <div className="mono text-[10px] text-muted-foreground">{o.buyer_email}</div>
                          <div className="mono text-[10px] text-muted-foreground">{o.buyer_phone}</div>
                        </td>
                        <td className="pr-4 mono text-xs uppercase">{o.manual_provider}</td>
                        <td className="pr-4 mono text-xs">{o.manual_tid}</td>
                        <td className="pr-4 mono">UGX {o.amount_ugx.toLocaleString()}</td>
                        <td className="pr-4 mono text-[10px] uppercase tracking-[0.2em]">{o.status}</td>
                        <td className="text-right">
                          <div className="flex gap-2 justify-end flex-wrap">
                            {o.status === "pending" && (
                              <>
                                <button onClick={() => confirmOrder(o)} className="bg-site-red text-site-white px-3 py-1 rounded mono text-[10px] uppercase" data-hover>Confirm & Email</button>
                                <button onClick={() => rejectOrder(o)} className="border border-border px-3 py-1 rounded mono text-[10px] uppercase" data-hover>Reject</button>
                              </>
                            )}
                            {o.status === "paid" && (
                              <button onClick={() => sendTickets(o.id)} className="border border-site-red text-site-red px-3 py-1 rounded mono text-[10px] uppercase" data-hover>Resend tickets</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!pending.length && <tr><td colSpan={8} className="py-6 mono text-xs text-muted-foreground">No manual submissions yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "manager" && (
          <div className="mt-8 grid lg:grid-cols-2 gap-12">
            <div className="border border-border rounded-lg p-6">
              <h2 className="display text-2xl">{editingId ? "Edit" : "New"} event</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["slug", "Slug (URL, optional)"],
                  ["title", "Title"],
                  ["venue", "Venue"],
                ].map(([k, l]) => (
                  <input key={k} placeholder={l} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full bg-transparent border-b border-border py-2" />
                ))}
                <div className="border border-border rounded p-3 space-y-2">
                  <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Poster (shown clean, no fade — prefer portrait)</label>
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPoster(f); }} className="text-sm" />
                  {form.poster_url && (
                    <div className="flex items-center gap-3">
                      <img src={form.poster_url} alt="poster" className="h-24 w-16 object-cover rounded" />
                      <button type="button" onClick={() => setForm({ ...form, poster_url: "" })} className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Clear</button>
                    </div>
                  )}
                  <input placeholder="…or paste an existing image URL" value={form.poster_url || ""} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} className="w-full bg-transparent border-b border-border py-2 text-xs" />
                </div>
                <div className="border border-border rounded p-3 space-y-2">
                  <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Cover image (atmospheric backdrop with fade, used when no poster)</label>
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} className="text-sm" />
                  {form.cover_url && (
                    <div className="flex items-center gap-3">
                      <img src={form.cover_url} alt="cover" className="h-16 w-24 object-cover rounded" />
                      <button type="button" onClick={() => setForm({ ...form, cover_url: "" })} className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">Clear</button>
                    </div>
                  )}
                  <input placeholder="…or paste an existing image URL" value={form.cover_url || ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} className="w-full bg-transparent border-b border-border py-2 text-xs" />
                </div>
                <textarea placeholder="Description" rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-transparent border border-border rounded p-3" />
                <textarea placeholder="Policy (refunds, entry rules, dress code…)" rows={4} value={form.policy || ""} onChange={(e) => setForm({ ...form, policy: e.target.value })} className="w-full bg-transparent border border-border rounded p-3" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">Starts<input type="datetime-local" value={form.starts_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                  <label className="text-xs">Ends<input type="datetime-local" value={form.ends_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                </div>


                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">MoMo merchant #<input placeholder="e.g. 0772 000 000" value={form.momo_number || ""} onChange={(e) => setForm({ ...form, momo_number: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                  <label className="text-xs">Airtel merchant #<input placeholder="e.g. 0752 000 000" value={form.airtel_number || ""} onChange={(e) => setForm({ ...form, airtel_number: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">Age limit (blank = none)<input type="number" min={0} placeholder="e.g. 18" value={form.age_limit || ""} onChange={(e) => setForm({ ...form, age_limit: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                  <div />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 mono text-xs uppercase tracking-[0.2em]">
                    <input type="checkbox" checked={form.pesapal_enabled !== false} onChange={(e) => setForm({ ...form, pesapal_enabled: e.target.checked })} />
                    Pesapal open
                  </label>
                  <label className="flex items-center gap-2 mono text-xs uppercase tracking-[0.2em]">
                    <input type="checkbox" checked={form.manual_enabled !== false} onChange={(e) => setForm({ ...form, manual_enabled: e.target.checked })} />
                    Manual TID open
                  </label>
                </div>

                <div className="border border-border rounded p-3 space-y-2">
                  <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Gallery</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && uploadGallery(e.target.files)} className="text-sm" />
                  {form.gallery?.length ? (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {form.gallery.map((u: string, i: number) => (
                        <div key={i} className="relative">
                          <img src={u} alt={`gallery ${i + 1}`} className="w-full h-20 object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, gallery: form.gallery.filter((_: string, j: number) => j !== i) })}
                            className="absolute -top-2 -right-2 bg-site-red text-site-white w-5 h-5 rounded-full text-xs"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mono text-[10px] text-muted-foreground">No gallery images yet.</p>
                  )}
                </div>

                <div className="border border-border rounded p-3 space-y-2">
                  <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Organizer</label>
                  <input placeholder="Organizer name" value={form.organizer_name || ""} onChange={(e) => setForm({ ...form, organizer_name: e.target.value })} className="w-full bg-transparent border-b border-border py-2" />
                  <div className="space-y-2">
                    {(form.organizer_socials || []).map((s: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <input placeholder="Label (Instagram)" value={s.label} onChange={(e) => { const arr = [...form.organizer_socials]; arr[i] = { ...arr[i], label: e.target.value }; setForm({ ...form, organizer_socials: arr }); }} className="flex-1 bg-transparent border-b border-border py-1 text-xs" />
                        <input placeholder="https://…" value={s.url} onChange={(e) => { const arr = [...form.organizer_socials]; arr[i] = { ...arr[i], url: e.target.value }; setForm({ ...form, organizer_socials: arr }); }} className="flex-[2] bg-transparent border-b border-border py-1 text-xs" />
                        <button type="button" onClick={() => setForm({ ...form, organizer_socials: form.organizer_socials.filter((_: any, j: number) => j !== i) })} className="mono text-[10px] text-site-red">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({ ...form, organizer_socials: [...(form.organizer_socials || []), { label: "", url: "" }] })} className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-site-red">+ add social</button>
                  </div>
                </div>

                <div className="border border-border rounded p-3 space-y-2">
                  <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Ticket PDF template</label>
                  <input type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTemplatePdf(f); }} className="text-sm" />
                  {form.ticket_template_url && (
                    <div className="flex items-center gap-3">
                      <span className="mono text-[10px] text-muted-foreground truncate flex-1">{form.ticket_template_url}</span>
                      <button type="button" onClick={() => setForm({ ...form, ticket_template_url: "" })} className="mono text-[10px] uppercase text-site-red">Clear</button>
                    </div>
                  )}
                  <p className="mono text-[10px] text-muted-foreground">Leave empty to use the default layout. Available field keys: event_title, tier_name, holder_name, starts_at, venue, order_ref, ticket_id, qr.</p>
                  <textarea
                    rows={8}
                    value={JSON.stringify(form.ticket_template_fields || DEFAULT_TEMPLATE_FIELDS, null, 2)}
                    onChange={(e) => {
                      try { setForm({ ...form, ticket_template_fields: JSON.parse(e.target.value) }); } catch { /* ignore */ }
                    }}
                    className="w-full bg-transparent border border-border rounded p-2 font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">Sender name<input value={form.sender_from_name || ""} onChange={(e) => setForm({ ...form, sender_from_name: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                  <label className="text-xs">Sender email (no-reply)<input value={form.sender_from_email || ""} onChange={(e) => setForm({ ...form, sender_from_email: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                </div>

                <label className="flex items-center gap-2 mono text-xs uppercase tracking-[0.2em]">
                  <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                  Published
                </label>
                <div className="flex gap-3">
                  <button onClick={save} disabled={uploading} className="bg-site-red text-site-white px-6 py-3 rounded-full mono text-xs uppercase disabled:opacity-50" data-hover>{uploading ? "Uploading…" : "Save"}</button>
                  {editingId && <button onClick={() => { setEditingId(null); setForm(empty); }} className="border border-border px-6 py-3 rounded-full mono text-xs uppercase" data-hover>Cancel</button>}
                </div>
              </div>
            </div>

            <div>
              <h2 className="display text-2xl mb-4">All events</h2>
              <div className="space-y-3">
                {events.map((e) => (
                  <div key={e.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div>
                        <div className="display text-xl">{e.title}</div>
                        <div className="mono text-xs text-muted-foreground">/{e.slug} · {new Date(e.starts_at).toLocaleString()} · {e.published ? "LIVE" : "draft"}</div>
                        <div className="mt-1 flex flex-wrap gap-2 mono text-[10px] uppercase tracking-[0.2em]">
                          {e.age_limit && <span className="border border-site-red text-site-red px-2 py-0.5 rounded-full">{e.age_limit}+</span>}
                          <span className={`px-2 py-0.5 rounded-full border ${e.pesapal_enabled === false ? "border-muted-foreground text-muted-foreground" : "border-site-red/50"}`}>Pesapal {e.pesapal_enabled === false ? "closed" : "open"}</span>
                          <span className={`px-2 py-0.5 rounded-full border ${e.manual_enabled === false ? "border-muted-foreground text-muted-foreground" : "border-site-red/50"}`}>Manual {e.manual_enabled === false ? "closed" : "open"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mono text-[10px] uppercase tracking-[0.2em] flex-wrap">
                        <button onClick={() => { setEditingId(e.id); setForm({ ...empty, ...e, gallery: e.gallery || [] }); }} className="px-3 py-1 border border-border rounded" data-hover>Edit</button>
                        <button onClick={() => loadTiers(e.id)} className="px-3 py-1 border border-border rounded" data-hover>Tiers</button>
                        <button onClick={() => exportCsv(e.id)} className="px-3 py-1 border border-border rounded" data-hover>CSV</button>
                        <button onClick={() => del(e.id)} className="px-3 py-1 border border-site-red text-site-red rounded" data-hover>Del</button>
                      </div>
                    </div>
                    {tierEventId === e.id && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mono text-xs uppercase tracking-[0.2em] mb-2">Ticket tiers</div>
                        {tiers.map((t) => (
                          <div key={t.id} className="flex justify-between items-start text-sm py-2 border-b border-border/50 last:border-b-0">
                            <div>
                              <div>{t.name} — UGX {t.price_ugx.toLocaleString()} × {t.capacity}</div>
                              <div className="mono text-[10px] text-muted-foreground">
                                {t.sales_start_at ? `From ${new Date(t.sales_start_at).toLocaleString()}` : "No start"} · {t.sales_end_at ? `Until ${new Date(t.sales_end_at).toLocaleString()}` : "No end"}
                              </div>
                            </div>
                            <button onClick={() => delTier(t.id)} className="text-site-red mono text-[10px]" data-hover>remove</button>
                          </div>
                        ))}
                        <div className="mt-3 space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <input placeholder="Tier name" value={tierForm.name} onChange={(ev) => setTierForm({ ...tierForm, name: ev.target.value })} className="bg-transparent border-b border-border py-1 text-sm" />
                            <input type="number" placeholder="UGX" value={tierForm.price_ugx} onChange={(ev) => setTierForm({ ...tierForm, price_ugx: ev.target.value })} className="bg-transparent border-b border-border py-1 text-sm" />
                            <input type="number" placeholder="Capacity" value={tierForm.capacity} onChange={(ev) => setTierForm({ ...tierForm, capacity: ev.target.value })} className="bg-transparent border-b border-border py-1 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sales open<input type="datetime-local" value={tierForm.sales_start_at} onChange={(ev) => setTierForm({ ...tierForm, sales_start_at: ev.target.value })} className="w-full bg-transparent border-b border-border py-1 text-sm" /></label>
                            <label className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sales close<input type="datetime-local" value={tierForm.sales_end_at} onChange={(ev) => setTierForm({ ...tierForm, sales_end_at: ev.target.value })} className="w-full bg-transparent border-b border-border py-1 text-sm" /></label>
                          </div>
                          <button onClick={addTier} className="mt-2 mono text-[10px] uppercase tracking-[0.2em] border border-site-red px-3 py-1 rounded" data-hover>Add tier</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "buyers" && (
          <div className="mt-8">
            <div className="flex gap-3 items-end flex-wrap">
              <label className="flex-1 min-w-[280px]">
                <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Search buyer (fuzzy · name, email, phone, TID)</span>
                <input
                  placeholder="e.g. Nakato · +25677… · CI250721"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent border-b border-border focus:border-site-red py-2 mt-1"
                />
              </label>
              <label>
                <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Event</span>
                <select value={scopeEventId} onChange={(e) => setScopeEventId(e.target.value)} className="bg-background border border-border rounded px-3 py-2 mt-1">
                  <option value="">All events</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </label>
              <button onClick={() => exportCsv(scopeEventId || undefined)} className="mono text-xs uppercase tracking-[0.2em] border border-site-red px-4 py-2 rounded-full" data-hover>Export CSV</button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-left">
                  <tr>
                    <th className="py-2 pr-4">Match</th>
                    <th className="pr-4">Buyer</th>
                    <th className="pr-4">Event</th>
                    <th className="pr-4">Method</th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">Amount</th>
                    <th className="pr-4">When</th>
                    <th className="pr-4">TID / Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((o: any) => (
                    <tr key={o.order_id} className="border-t border-border align-top">
                      <td className="py-3 pr-4 mono text-[10px] text-site-red">{typeof o.score === "number" ? `${Math.round(o.score * 100)}%` : ""}</td>
                      <td className="pr-4">
                        <div>{o.buyer_name}</div>
                        <div className="mono text-[10px] text-muted-foreground">{o.buyer_email}</div>
                        <div className="mono text-[10px] text-muted-foreground">{o.buyer_phone}</div>
                      </td>
                      <td className="pr-4">{o.event_title}</td>
                      <td className="pr-4 mono text-xs uppercase">{o.payment_method}{o.manual_provider ? ` · ${o.manual_provider}` : ""}</td>
                      <td className="pr-4 mono text-[10px] uppercase tracking-[0.2em]">{o.status}</td>
                      <td className="pr-4 mono">UGX {Number(o.amount_ugx || 0).toLocaleString()}</td>
                      <td className="pr-4 mono text-xs">{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</td>
                      <td className="pr-4 mono text-xs">{o.manual_tid || o.pesapal_merchant_reference}</td>
                    </tr>
                  ))}
                  {!results.length && !searching && query && <tr><td colSpan={8} className="py-6 mono text-xs text-muted-foreground">No matches. Try a shorter query — spelling doesn't have to be exact.</td></tr>}
                  {!query && <tr><td colSpan={8} className="py-6 mono text-xs text-muted-foreground">Start typing a name, email, phone or TID.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
