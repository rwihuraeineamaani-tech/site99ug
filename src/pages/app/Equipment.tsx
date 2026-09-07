import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { Trash2 } from "lucide-react";

type Gear = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  notes: string | null;
  active: boolean;
};

export const GEAR_CATEGORIES = ["camera", "lens", "lighting", "audio", "grip", "other"];

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

export default function Equipment() {
  const { isLeadership } = useMyRoles();
  const [rows, setRows] = useState<Gear[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("camera");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("equipment").select("*").order("category").order("name");
    setRows((data as Gear[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("equipment")
      .insert({ name: name.trim(), category, quantity: Math.max(1, Number(quantity) || 1) });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setQuantity("1");
    load();
  };

  const patch = async (id: string, values: Partial<Gear>) => {
    const { error } = await supabase.from("equipment").update(values).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <AppShell>
      <Seo title="Equipment — Site 99" description="The kit list: what we own and what's booked out." path="/app/equipment" noindex />
      <PageHeader
        eyebrow="Management & ops"
        title="Equipment."
        lede="Everything we own. Gear ticked on a shoot day is booked for that date and can't go out twice."
      />

      {isLeadership && (
        <div className="mt-8 surface rounded-2xl p-4 grid gap-3 sm:grid-cols-[2fr_1fr_100px_auto] sm:items-end">
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Name</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sony FX3" />
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Category</span>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
              {GEAR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">How many</span>
            <input className={field} type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <Button disabled={busy || !name.trim()} onClick={add}>
            Add
          </Button>
        </div>
      )}

      <div className="mt-10">
        <SectionHeading index="01" title="Kit list" hint={`${rows.length} item${rows.length === 1 ? "" : "s"}`} />
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing on the list yet.</p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {rows.map((g) => (
              <li key={g.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="font-medium">{g.name}</span>
                <StatusChip value={g.category} tone="violet" />
                <span className="num text-xs text-ink-soft">×{g.quantity}</span>
                {!g.active && <span className="text-xs text-ink-faint">retired</span>}
                {isLeadership && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs press focus-ring"
                      onClick={() => patch(g.id, { active: !g.active })}
                    >
                      {g.active ? "Retire" : "Bring back"}
                    </button>
                    <button className="text-ink-faint hover:text-signal focus-ring" onClick={() => remove(g.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
