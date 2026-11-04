import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadSiteLogos, type SiteLogo } from "@/lib/siteLogos";

type Row = SiteLogo & { url: string | null };
const field = "w-full rounded-md border border-rule bg-background px-3 py-2 text-sm";

export default function SiteLogosManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setRows(await loadSiteLogos(true)); } catch (e) { toast.error((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const file = fileRef.current?.files?.[0];
    if (!name.trim() || !file) return toast.error("Add a name and choose a logo file.");
    setBusy(true);
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop() || "png"}`;
    const up = await supabase.storage.from("site-logos").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("site_logos").insert({ name: name.trim(), image_path: path, link_url: link.trim() || null, sort_order: max + 1 });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); setLink(""); if (fileRef.current) fileRef.current.value = "";
    toast.success("Logo added to the homepage.");
    load();
  };

  const patch = async (id: string, values: Partial<SiteLogo>) => {
    const { error } = await supabase.from("site_logos").update(values).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    await Promise.all([
      supabase.from("site_logos").update({ sort_order: j }).eq("id", a.id),
      supabase.from("site_logos").update({ sort_order: i }).eq("id", b.id),
    ]);
    // normalise the rest
    await Promise.all(rows.map((r, k) => (k !== i && k !== j && r.sort_order !== k ? supabase.from("site_logos").update({ sort_order: k }).eq("id", r.id) : null)));
    load();
  };

  const remove = async (r: Row) => {
    if (!confirm(`Remove ${r.name} from the homepage logos?`)) return;
    const { error } = await supabase.from("site_logos").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    if (r.bucket === "site-logos") await supabase.storage.from("site-logos").remove([r.image_path]);
    toast.success("Logo removed.");
    load();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">These logos scroll on the homepage. They are separate from client records, so you can show any brand. Use logos with white backgrounds for the cleanest look.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
        <label className="text-xs text-ink-soft">Name<input className={`${field} mt-2`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" /></label>
        <label className="text-xs text-ink-soft">Website link (optional)<input className={`${field} mt-2`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
        <label className="text-xs text-ink-soft">Logo file<input ref={fileRef} className={`${field} mt-2`} type="file" accept="image/*" /></label>
        <Button onClick={add} disabled={busy}><Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Add logo"}</Button>
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {rows.length === 0 && <li className="py-8 text-sm text-ink-soft">No logos yet. The homepage strip stays hidden until you add one.</li>}
        {rows.map((r, i) => (
          <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
            <div className="logo-strip flex h-14 w-32 items-center justify-center rounded-md border border-rule p-2">
              {r.url ? <img src={r.url} alt={r.name} className="max-h-10 max-w-full object-contain" /> : <span className="text-xs text-ink-faint">No image</span>}
            </div>
            <input className={`${field} max-w-[220px]`} defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && patch(r.id, { name: e.target.value.trim() })} />
            <input className={`${field} max-w-[240px]`} defaultValue={r.link_url ?? ""} placeholder="Link" onBlur={(e) => e.target.value !== (r.link_url ?? "") && patch(r.id, { link_url: e.target.value.trim() || null })} />
            {!r.visible && <span className="text-xs text-ink-faint">Hidden</span>}
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={r.visible ? "Hide" : "Show"} onClick={() => patch(r.id, { visible: !r.visible })}>{r.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
