import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { openStorageFile } from "@/lib/clientMonth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export const FILE_CATEGORIES = [
  { key: "logo", label: "Logos" },
  { key: "product", label: "Product photos" },
  { key: "price_list", label: "Price lists" },
  { key: "other", label: "Other" },
] as const;
type F = { id: string; category: string; label: string; file_path: string; uploaded_by: string; uploaded_by_client: boolean; created_at: string; mime_type: string | null };

/** Brand files shared between client and team. */
export default function ClientFiles({ residentId, staff = false }: { residentId: string; staff?: boolean }) {
  const { userId } = useMyRoles();
  const [files, setFiles] = useState<F[]>([]);
  const [cat, setCat] = useState<string>("logo");
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await db.from("client_files").select("*").eq("resident_id", residentId).order("created_at", { ascending: false });
    const rows: F[] = data ?? [];
    setFiles(rows);
    const imgs = rows.filter((r) => r.mime_type?.startsWith("image/"));
    if (imgs.length) {
      const { data: urls } = await supabase.storage.from("resident-files").createSignedUrls(imgs.map((r) => r.file_path), 600);
      const map: Record<string, string> = {};
      urls?.forEach((u, i) => { if (u.signedUrl) map[imgs[i].id] = u.signedUrl; });
      setThumbs(map);
    }
  };
  useEffect(() => { load(); }, [residentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (list: FileList) => {
    setBusy(true);
    for (const f of Array.from(list)) {
      const path = `${residentId}/files/${cat}-${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("resident-files").upload(path, f);
      if (up.error) { toast.error(up.error.message); continue; }
      const { error } = await db.from("client_files").insert({ resident_id: residentId, category: cat, label: f.name, file_path: path, mime_type: f.type, size_bytes: f.size, uploaded_by: userId, uploaded_by_client: !staff });
      if (error) toast.error(error.message);
    }
    setBusy(false);
    toast.success(staff ? "Uploaded." : "Uploaded. Your Handler has been told.");
    load();
  };
  const remove = async (f: F) => {
    if (!confirm(`Delete ${f.label}?`)) return;
    await supabase.storage.from("resident-files").remove([f.file_path]);
    const { error } = await db.from("client_files").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="surface flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <select className="ctl rounded-full px-3 py-1.5 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
          {FILE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <label className={`ctl ctl-solid press inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-xs ${busy ? "opacity-60" : ""}`}>
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload files"}
          <input type="file" multiple className="hidden" disabled={busy} onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="text-xs text-ink-faint">Logos, product photos, price lists, anything we should use in your content.</span>
      </div>
      {FILE_CATEGORIES.map((c) => {
        const list = files.filter((f) => (f.category ?? "other") === c.key);
        if (!list.length) return null;
        return (
          <section key={c.key}>
            <h3 className="mb-2 text-sm font-medium">{c.label} <span className="text-ink-faint">· {list.length}</span></h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((f) => (
                <li key={f.id} className="surface overflow-hidden rounded-xl">
                  <button className="block aspect-[4/3] w-full bg-paper-sunken" onClick={() => openStorageFile(f.file_path).catch((e) => toast.error(e.message))}>
                    {thumbs[f.id] ? <img src={thumbs[f.id]} alt={f.label} className="h-full w-full object-contain" loading="lazy" /> : <span className="text-xs text-ink-faint">Open file</span>}
                  </button>
                  <div className="flex items-start justify-between gap-2 p-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs">{f.label}</div>
                      <div className="text-[10px] text-ink-faint">{f.uploaded_by_client ? "From client" : "From Site 99"} · {new Date(f.created_at).toLocaleDateString("en-GB")}</div>
                    </div>
                    {(staff || f.uploaded_by === userId) && (
                      <button aria-label={`Delete ${f.label}`} className="text-ink-faint hover:text-destructive" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!files.length && <p className="text-sm text-ink-faint">No files yet.</p>}
    </div>
  );
}
