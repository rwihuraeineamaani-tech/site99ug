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
  published: false,
};

export default function EventsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tierEventId, setTierEventId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierForm, setTierForm] = useState({ name: "", price_ugx: 0, capacity: 100 });

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getUser();
      if (!s.user) return setIsAdmin(false);
      const { data: r } = await supabase.rpc("has_role", { _user_id: s.user.id, _role: "admin" });
      setIsAdmin(!!r);
      if (r) load();
    })();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
    setEvents(data || []);
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
    const { error } = await supabase.from("ticket_tiers").insert({ ...tierForm, event_id: tierEventId, sort: tiers.length });
    if (error) return toast.error(error.message);
    setTierForm({ name: "", price_ugx: 0, capacity: 100 });
    loadTiers(tierEventId);
  };

  const delTier = async (id: string) => {
    await supabase.from("ticket_tiers").delete().eq("id", id);
    if (tierEventId) loadTiers(tierEventId);
  };

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
          <Link to="/admin/scan" className="mono text-xs uppercase tracking-[0.2em] border border-site-red px-4 py-2 rounded-full" data-hover>
            Open Scanner →
          </Link>
        </div>

        <div className="mt-10 grid lg:grid-cols-2 gap-12">
          <div className="border border-border rounded-lg p-6">
            <h2 className="display text-2xl">{editingId ? "Edit" : "New"} event</h2>
            <div className="mt-4 space-y-3">
              {[
                ["slug", "Slug (URL)"],
                ["title", "Title"],
                ["venue", "Venue"],
                ["cover_url", "Cover image URL"],
              ].map(([k, l]) => (
                <input key={k} placeholder={l} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full bg-transparent border-b border-border py-2" />
              ))}
              <textarea placeholder="Description" rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-transparent border border-border rounded p-3" />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">Starts<input type="datetime-local" value={form.starts_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
                <label className="text-xs">Ends<input type="datetime-local" value={form.ends_at?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="w-full bg-transparent border-b border-border py-2" /></label>
              </div>
              <label className="flex items-center gap-2 mono text-xs uppercase tracking-[0.2em]">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                Published
              </label>
              <div className="flex gap-3">
                <button onClick={save} className="bg-site-red text-site-white px-6 py-3 rounded-full mono text-xs uppercase" data-hover>Save</button>
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
                      <button onClick={() => { setEditingId(e.id); setForm(e); }} className="px-3 py-1 border border-border rounded" data-hover>Edit</button>
                      <button onClick={() => loadTiers(e.id)} className="px-3 py-1 border border-border rounded" data-hover>Tiers</button>
                      <button onClick={() => del(e.id)} className="px-3 py-1 border border-site-red text-site-red rounded" data-hover>Del</button>
                    </div>
                  </div>
                  {tierEventId === e.id && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mono text-xs uppercase tracking-[0.2em] mb-2">Ticket tiers</div>
                      {tiers.map((t) => (
                        <div key={t.id} className="flex justify-between text-sm py-1">
                          <span>{t.name} — UGX {t.price_ugx.toLocaleString()} × {t.capacity}</span>
                          <button onClick={() => delTier(t.id)} className="text-site-red mono text-[10px]" data-hover>remove</button>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <input placeholder="Name" value={tierForm.name} onChange={(ev) => setTierForm({ ...tierForm, name: ev.target.value })} className="bg-transparent border-b border-border py-1 text-sm" />
                        <input type="number" placeholder="UGX" value={tierForm.price_ugx} onChange={(ev) => setTierForm({ ...tierForm, price_ugx: Number(ev.target.value) })} className="bg-transparent border-b border-border py-1 text-sm" />
                        <input type="number" placeholder="Capacity" value={tierForm.capacity} onChange={(ev) => setTierForm({ ...tierForm, capacity: Number(ev.target.value) })} className="bg-transparent border-b border-border py-1 text-sm" />
                      </div>
                      <button onClick={addTier} className="mt-3 mono text-[10px] uppercase tracking-[0.2em] border border-site-red px-3 py-1 rounded" data-hover>Add tier</button>
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
