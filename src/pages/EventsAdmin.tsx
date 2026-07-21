import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = {
  slug: "",
  title: "",
  description: "",
  venue: "",
  starts_at: "",
  ends_at: "",
  cover_url: "",
  momo_number: "",
  airtel_number: "",
  published: false,
};

const emptyTier = { name: "", price_ugx: 0, capacity: 100, sales_start_at: "", sales_end_at: "" };

export default function EventsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierEventId, setTierEventId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierForm, setTierForm] = useState<any>(emptyTier);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<any[]>([]);

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("project-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const url = supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
      setForm((f: any) => ({ ...f, cover_url: url }));
      toast.success("Cover uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
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
      .select("id, buyer_name, buyer_email, buyer_phone, amount_ugx, manual_tid, manual_provider, status, created_at, pesapal_merchant_reference, event_id, events(title)")
      .eq("payment_method", "manual")
      .in("status", ["pending", "paid", "rejected"])
      .order("created_at", { ascending: false })
      .limit(100);
    setPending(data || []);
  };

  const loadTiers = async (eventId: string) => {
    const { data } = await supabase.from("ticket_tiers").select("*").eq("event_id", eventId).order("sort");
    setTiers(data || []);
    setTierEventId(eventId);
  };

  const save = async () => {
    const payload = { ...form, ends_at: form.ends_at || null };
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
    if (!confirm(`Confirm payment of UGX ${o.amount_ugx.toLocaleString()} from ${o.buyer_name} (TID ${o.manual_tid})?`)) return;
    const { data: s } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), manual_confirmed_by: s.user?.id, manual_confirmed_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) return toast.error(error.message);
    // Activate tickets (default status is 'valid' via schema, ensure it)
    await supabase.from("tickets").update({ status: "valid" }).eq("order_id", o.id);
    toast.success("Confirmed — tickets are live");
    loadPending();
  };

  const rejectOrder = async (o: any) => {
    if (!confirm(`Reject this order (TID ${o.manual_tid})? Tickets will be voided.`)) return;
    const { error } = await supabase.from("orders").update({ status: "rejected" }).eq("id", o.id);
    if (error) return toast.error(error.message);
    await supabase.from("tickets").update({ status: "void" }).eq("order_id", o.id);
    toast.success("Rejected");
    loadPending();
  };

  if (isAdmin === null) return <Layout><p className="p-16">Loading…</p></Layout>;
  if (!isAdmin) return <Layout><div className="p-16"><p>Admin only. <Link to="/admin/login" className="underline">Sign in</Link></p></div></Layout>;

  const pendingCount = pending.filter((p) => p.status === "pending").length;

  return (
    <Layout>
      <Seo title="Events Admin — Site 99" description="Manage events" path="/admin/events" />
      <section className="pt-28 pb-16 px-8 md:px-16">
        <div className="flex justify-between items-baseline gap-6 flex-wrap">
          <div>
            <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Admin</div>
            <h1 className="display text-5xl mt-2">Events</h1>
          </div>
          <Link to="/admin/scan" className="mono text-xs uppercase tracking-[0.2em] border border-site-red px-4 py-2 rounded-full" data-hover>
            Open Scanner →
          </Link>
        </div>

        {/* Manual TID confirmations */}
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
                      {o.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => confirmOrder(o)} className="bg-site-red text-site-white px-3 py-1 rounded mono text-[10px] uppercase" data-hover>Confirm</button>
                          <button onClick={() => rejectOrder(o)} className="border border-border px-3 py-1 rounded mono text-[10px] uppercase" data-hover>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!pending.length && <tr><td colSpan={8} className="py-6 mono text-xs text-muted-foreground">No manual submissions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 grid lg:grid-cols-2 gap-12">
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
                <label className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground block">Cover image</label>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">Starts<input type="datetime-local" value={form.starts_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                <label className="text-xs">Ends<input type="datetime-local" value={form.ends_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">MoMo merchant #<input placeholder="e.g. 0772 000 000" value={form.momo_number || ""} onChange={(e) => setForm({ ...form, momo_number: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                <label className="text-xs">Airtel merchant #<input placeholder="e.g. 0752 000 000" value={form.airtel_number || ""} onChange={(e) => setForm({ ...form, airtel_number: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
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
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="display text-xl">{e.title}</div>
                      <div className="mono text-xs text-muted-foreground">/{e.slug} · {new Date(e.starts_at).toLocaleString()} · {e.published ? "LIVE" : "draft"}</div>
                    </div>
                    <div className="flex gap-2 mono text-[10px] uppercase tracking-[0.2em]">
                      <button onClick={() => { setEditingId(e.id); setForm({ ...empty, ...e }); }} className="px-3 py-1 border border-border rounded" data-hover>Edit</button>
                      <button onClick={() => loadTiers(e.id)} className="px-3 py-1 border border-border rounded" data-hover>Tiers</button>
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
      </section>
    </Layout>
  );
}
