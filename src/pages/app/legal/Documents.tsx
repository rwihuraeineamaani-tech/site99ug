import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { SectionHeading, StatusChip, FilterBar, SearchInput, SelectFilter } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { DOC_CATEGORIES, field, ghostBtn, solidBtn } from "@/lib/legal";

type Doc = {
  id: string;
  title: string;
  category: string;
  version: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
};

export default function Documents() {
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canWrite = isLeadership || canSeeFinance || has("legal");

  const [rows, setRows] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", category: "template", version: "", notes: "" });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("legal_documents")
      .select("id, title, category, version, file_path, notes, created_at")
      .order("created_at", { ascending: false });
    setRows((data as Doc[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (cat === "all" || r.category === cat) && (!needle || r.title.toLowerCase().includes(needle)));
  }, [rows, q, cat]);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Give the document a name.");
    setBusy(true);
    let file_path: string | null = null;
    if (file) {
      const clean = file.name.replace(/[^\w.\-]+/g, "-");
      const path = `documents/${crypto.randomUUID()}-${clean}`;
      const up = await supabase.storage.from("legal-files").upload(path, file);
      if (up.error) {
        setBusy(false);
        return toast.error(up.error.message);
      }
      file_path = path;
    }
    const { error } = await supabase.from("legal_documents").insert({
      title: form.title.trim(),
      category: form.category,
      version: form.version.trim() || null,
      notes: form.notes.trim() || null,
      file_path,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document added.");
    setForm({ title: "", category: "template", version: "", notes: "" });
    setFile(null);
    load();
  };

  const openFile = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("legal-files").createSignedUrl(path, 120);
    if (error || !data) return toast.error(error?.message ?? "Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("legal_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <SectionPage
      eyebrow="Legal"
      title="Documents."
      lede="Templates, NDAs and policies kept in one private place."
      path="/app/legal/documents"
    >
      {canWrite && (
        <section className="mb-10 surface rounded-2xl p-5 md:p-6">
          <SectionHeading index="00" title="Add a document" hint="Kept private" />
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-xs text-ink-soft">
              Name
              <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              Category
              <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              Version
              <input className={field} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </label>
            <label className="text-xs text-ink-soft">
              File
              <input type="file" className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="text-xs text-ink-soft md:col-span-4">
              Notes
              <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="mt-5">
            <button className={solidBtn} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Add document"}
            </button>
          </div>
        </section>
      )}

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search documents…" />
        <SelectFilter
          label="Category"
          value={cat}
          onChange={setCat}
          options={[{ value: "all", label: "Any category" }, ...DOC_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
      </FilterBar>

      {loading ? (
        <div className="surface rounded-xl h-40 animate-pulse" />
      ) : !shown.length ? (
        <div className="surface rounded-xl p-12 text-center text-sm text-ink-soft">Nothing in the library yet.</div>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {shown.map((r) => (
            <li key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-semibold text-sm">{r.title}</div>
                {r.notes && <div className="text-xs text-ink-soft">{r.notes}</div>}
              </div>
              <StatusChip value={r.category} />
              <span className="text-xs text-ink-soft w-20">{r.version || "—"}</span>
              {r.file_path && (
                <button className={ghostBtn} onClick={() => openFile(r.file_path)}>
                  Open
                </button>
              )}
              {canWrite && (
                <button className={ghostBtn} onClick={() => remove(r.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}
