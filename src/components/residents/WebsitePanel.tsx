import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading } from "@/components/system";
import { Button } from "@/components/ui/button";
import { ACCOUNT_PLATFORMS } from "@/lib/weeks";

type Site = { territory: string; since: string; display_order: number; visible: boolean };
type AccountRow = { id: string; platform: string; handle: string; active: boolean; sort: number };

/** Website listing + managed social accounts, edited on the Resident record (the one home for clients). */
export default function WebsitePanel({ residentId, index, canEdit }: { residentId: string; index: string; canEdit: boolean }) {
  const [site, setSite] = useState<Site | null>(null);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [platform, setPlatform] = useState(ACCOUNT_PLATFORMS[0]);
  const [handle, setHandle] = useState("");

  const load = async () => {
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("residents").select("territory,since,display_order,visible").eq("id", residentId).maybeSingle(),
      supabase.from("client_accounts").select("id,platform,handle,active,sort").eq("resident_id", residentId).order("sort"),
    ]);
    if (r) setSite({ territory: r.territory ?? "", since: r.since ?? "", display_order: r.display_order ?? 0, visible: r.visible !== false });
    setRows((a as AccountRow[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [residentId]);

  const save = async () => {
    if (!site) return;
    setSaving(true);
    const { error } = await supabase.from("residents").update(site).eq("id", residentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Website details saved");
  };
  const add = async () => {
    if (!handle.trim()) return toast.error("Add the @handle");
    const { error } = await supabase.from("client_accounts").insert({ resident_id: residentId, platform, handle: handle.trim(), sort: rows.length } as never);
    if (error) return toast.error(error.message);
    setHandle(""); load();
  };
  const toggle = async (r: AccountRow) => {
    const { error } = await supabase.from("client_accounts").update({ active: !r.active } as never).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (r: AccountRow) => {
    if (!confirm(`Remove ${r.platform} ${r.handle}? Its weekly numbers go too.`)) return;
    const { error } = await supabase.from("client_accounts").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!site) return null;
  const f = "field text-sm";
  return (
    <>
      <SectionHeading index={index} title="Website & social accounts" hint={site.visible ? "shown on the website" : "hidden from the website"} />
      <div className="surface rounded-2xl p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-ink-soft">Area & type (e.g. Kampala · Food)
            <input className={f} disabled={!canEdit} value={site.territory} onChange={(e) => setSite({ ...site, territory: e.target.value })} />
          </label>
          <label className="text-xs text-ink-soft">With us since
            <input className={f} disabled={!canEdit} value={site.since} onChange={(e) => setSite({ ...site, since: e.target.value })} />
          </label>
          <label className="text-xs text-ink-soft">Order on the website
            <input type="number" className={f} disabled={!canEdit} value={site.display_order} onChange={(e) => setSite({ ...site, display_order: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-soft flex items-center gap-2 mt-5">
            <input type="checkbox" disabled={!canEdit} checked={site.visible} onChange={(e) => setSite({ ...site, visible: e.target.checked })} />
            Show on the public website
          </label>
        </div>
        {canEdit && <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save website details"}</Button>}

        <div>
          <div className="eyebrow text-[10px] text-ink-faint mb-2">Social accounts we manage</div>
          <ul className="divide-y divide-rule rounded-xl surface-sunken overflow-hidden">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-center gap-3 text-sm flex-wrap">
                <span className="eyebrow text-[10px] w-24 shrink-0">{r.platform}</span>
                <span className="truncate">{r.handle}</span>
                {!r.active && <span className="text-[10px] text-ink-faint">paused</span>}
                {canEdit && (
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggle(r)}>{r.active ? "Stop managing" : "Resume"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Button>
                  </span>
                )}
              </li>
            ))}
            {rows.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No accounts added yet.</li>}
          </ul>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="field text-sm w-auto">
                {ACCOUNT_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="field text-sm w-auto flex-1 min-w-[10rem]" />
              <Button size="sm" variant="soft" onClick={add}>Add account</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
