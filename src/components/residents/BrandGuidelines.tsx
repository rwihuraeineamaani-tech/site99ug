import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { FileText, Printer, Trash2, Upload } from "lucide-react";

type Colour = { name: string; hex: string };

type Guidelines = {
  id: string;
  resident_id: string;
  primary_font: string | null;
  primary_font_use: string | null;
  secondary_font: string | null;
  secondary_font_use: string | null;
  colours: Colour[];
  tone: string | null;
  dos: string | null;
  donts: string | null;
  notes: string | null;
  pdf_path: string | null;
};

type Asset = { id: string; label: string; file_path: string; sort: number };

const field = "field text-sm";
const empty = {
  primary_font: "",
  primary_font_use: "",
  secondary_font: "",
  secondary_font_use: "",
  tone: "",
  dos: "",
  donts: "",
  notes: "",
};

export default function BrandGuidelines({
  residentId,
  residentName,
  index = "06",
}: {
  residentId: string;
  residentName: string;
  index?: string;
}) {
  const { userId, isLeadership, has } = useMyRoles();
  const [row, setRow] = useState<Guidelines | null>(null);
  const [form, setForm] = useState(empty);
  const [colours, setColours] = useState<Colour[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [{ data: g }, { data: a }, { data: res }] = await Promise.all([
      supabase.from("brand_guidelines").select("*").eq("resident_id", residentId).maybeSingle(),
      supabase.from("brand_assets").select("id, label, file_path, sort").eq("resident_id", residentId).order("sort"),
      supabase.from("residents").select("contact_user_id, handler_user_id").eq("id", residentId).maybeSingle(),
    ]);
    const g2 = g as unknown as Guidelines | null;
    setRow(g2);
    setForm({
      primary_font: g2?.primary_font ?? "",
      primary_font_use: g2?.primary_font_use ?? "",
      secondary_font: g2?.secondary_font ?? "",
      secondary_font_use: g2?.secondary_font_use ?? "",
      tone: g2?.tone ?? "",
      dos: g2?.dos ?? "",
      donts: g2?.donts ?? "",
      notes: g2?.notes ?? "",
    });
    setColours(Array.isArray(g2?.colours) ? (g2!.colours as Colour[]) : []);
    const list = ((a as Asset[]) ?? []);
    setAssets(list);
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (x) => {
        const { data } = await supabase.storage.from("brand-files").createSignedUrl(x.file_path, 3600);
        if (data?.signedUrl) urls[x.id] = data.signedUrl;
      })
    );
    setAssetUrls(urls);
    const r = res as { contact_user_id: string | null; handler_user_id: string | null } | null;
    setCanEdit(
      isLeadership || has("admin") || (!!userId && (r?.contact_user_id === userId || r?.handler_user_id === userId))
    );
  }, [residentId, isLeadership, has, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    const payload = {
      resident_id: residentId,
      primary_font: form.primary_font || null,
      primary_font_use: form.primary_font_use || null,
      secondary_font: form.secondary_font || null,
      secondary_font_use: form.secondary_font_use || null,
      tone: form.tone || null,
      dos: form.dos || null,
      donts: form.donts || null,
      notes: form.notes || null,
      colours: colours.filter((c) => c.hex.trim()) as unknown as never,
    };
    const { error } = row
      ? await supabase.from("brand_guidelines").update(payload).eq("id", row.id)
      : await supabase.from("brand_guidelines").insert({ ...payload, created_by: userId ?? null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Brand guidelines saved.");
    load();
  };

  const uploadPdf = async (file: File) => {
    setBusy(true);
    const clean = file.name.replace(/[^\w.\-]+/g, "-");
    const path = `${residentId}/pdf/${crypto.randomUUID()}-${clean}`;
    const { error: upErr } = await supabase.storage.from("brand-files").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = row
      ? await supabase.from("brand_guidelines").update({ pdf_path: path }).eq("id", row.id)
      : await supabase.from("brand_guidelines").insert({ resident_id: residentId, pdf_path: path, created_by: userId ?? null });
    setBusy(false);
    if (pdfRef.current) pdfRef.current.value = "";
    if (error) return toast.error(error.message);
    toast.success("Guidelines document uploaded.");
    load();
  };

  const openPdf = async () => {
    if (!row?.pdf_path) return;
    const { data, error } = await supabase.storage.from("brand-files").createSignedUrl(row.pdf_path, 300);
    if (error || !data) return toast.error(error?.message ?? "Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    const clean = file.name.replace(/[^\w.\-]+/g, "-");
    const path = `${residentId}/logos/${crypto.randomUUID()}-${clean}`;
    const { error: upErr } = await supabase.storage.from("brand-files").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("brand_assets").insert({
      resident_id: residentId,
      label: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Logo",
      file_path: path,
      sort: assets.length,
      created_by: userId ?? null,
    });
    setBusy(false);
    if (logoRef.current) logoRef.current.value = "";
    if (error) return toast.error(error.message);
    load();
  };

  const removeAsset = async (a: Asset) => {
    const { error } = await supabase.from("brand_assets").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("brand-files").remove([a.file_path]);
    load();
  };

  const has_any =
    !!row &&
    (row.primary_font || row.tone || row.dos || row.donts || row.notes || row.pdf_path || colours.length > 0);

  return (
    <div className="brand-sheet">
      <SectionHeading
        index={index}
        title="Brand guidelines"
        hint={canEdit ? "you can edit these" : "read only"}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print / save as PDF
        </Button>
        {row?.pdf_path && (
          <Button size="sm" variant="soft" onClick={openPdf} className="gap-2">
            <FileText className="h-4 w-4" /> Open the guidelines document
          </Button>
        )}
        <span className="text-[11px] text-ink-faint">Hand this to a shooter or editor before a job.</span>
      </div>

      {!has_any && !canEdit && (
        <p className="text-sm text-ink-soft">Nothing has been set for {residentName} yet.</p>
      )}

      <div className="surface rounded-2xl p-5 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Primary font</label>
            <input
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.primary_font}
              onChange={(e) => setForm({ ...form, primary_font: e.target.value })}
              placeholder="e.g. Söhne"
            />
          </div>
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Where it is used</label>
            <input
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.primary_font_use}
              onChange={(e) => setForm({ ...form, primary_font_use: e.target.value })}
              placeholder="Headlines and titles"
            />
          </div>
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Secondary font</label>
            <input
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.secondary_font}
              onChange={(e) => setForm({ ...form, secondary_font: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Where it is used</label>
            <input
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.secondary_font_use}
              onChange={(e) => setForm({ ...form, secondary_font_use: e.target.value })}
              placeholder="Body copy and captions"
            />
          </div>
        </div>

        <div>
          <div className="eyebrow text-[10px] text-ink-faint mb-2">Colours</div>
          <div className="flex flex-wrap gap-3">
            {colours.map((c, i) => (
              <div key={i} className="surface-sunken rounded-xl p-3 flex items-center gap-3">
                <span
                  className="h-8 w-8 rounded-lg border border-rule"
                  style={{ background: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.hex) ? c.hex : "transparent" }}
                />
                <div className="space-y-1">
                  <input
                    className="field text-xs w-32"
                    disabled={!canEdit}
                    value={c.name}
                    placeholder="Name"
                    onChange={(e) =>
                      setColours(colours.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <input
                    className="field text-xs w-32 num"
                    disabled={!canEdit}
                    value={c.hex}
                    placeholder="#000000"
                    onChange={(e) => setColours(colours.map((x, n) => (n === i ? { ...x, hex: e.target.value } : x)))}
                  />
                </div>
                {canEdit && (
                  <button
                    className="press text-ink-faint focus-ring no-print"
                    onClick={() => setColours(colours.filter((_, n) => n !== i))}
                    aria-label="Remove colour"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {colours.length === 0 && <p className="text-sm text-ink-soft">No colours set.</p>}
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="soft"
              className="mt-3 no-print"
              onClick={() => setColours([...colours, { name: "", hex: "#" }])}
            >
              Add a colour
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Tone of voice</label>
            <textarea
              rows={4}
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              placeholder="How they sound"
            />
          </div>
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Do</label>
            <textarea
              rows={4}
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.dos}
              onChange={(e) => setForm({ ...form, dos: e.target.value })}
            />
          </div>
          <div>
            <label className="eyebrow text-[10px] text-ink-faint">Don't</label>
            <textarea
              rows={4}
              className={`${field} mt-1`}
              disabled={!canEdit}
              value={form.donts}
              onChange={(e) => setForm({ ...form, donts: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="eyebrow text-[10px] text-ink-faint">Notes</label>
          <textarea
            rows={3}
            className={`${field} mt-1`}
            disabled={!canEdit}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div>
          <div className="eyebrow text-[10px] text-ink-faint mb-2">Logo files</div>
          <div className="flex flex-wrap gap-3">
            {assets.map((a) => (
              <div key={a.id} className="surface-sunken rounded-xl p-3 w-40 space-y-2">
                <div className="h-20 rounded-lg bg-paper-raised flex items-center justify-center overflow-hidden">
                  {assetUrls[a.id] ? (
                    <img src={assetUrls[a.id]} alt={`${residentName} ${a.label}`} className="max-h-20 object-contain" />
                  ) : (
                    <FileText className="h-5 w-5 text-ink-faint" />
                  )}
                </div>
                <div className="text-[11px] truncate">{a.label}</div>
                <div className="flex items-center gap-2 no-print">
                  {assetUrls[a.id] && (
                    <a
                      href={assetUrls[a.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] underline underline-offset-4"
                    >
                      Open
                    </a>
                  )}
                  {canEdit && (
                    <button className="press text-ink-faint focus-ring ml-auto" onClick={() => removeAsset(a)} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {assets.length === 0 && <p className="text-sm text-ink-soft">No logo files uploaded.</p>}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-4 no-print border-t border-rule pt-5">
            <div>
              <label className="eyebrow text-[10px] text-ink-faint">Add a logo file</label>
              <input
                ref={logoRef}
                type="file"
                accept="image/*,.svg,.ai,.eps,.pdf"
                className="text-xs mt-1 block"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
            </div>
            <div>
              <label className="eyebrow text-[10px] text-ink-faint">Guidelines PDF</label>
              <input
                ref={pdfRef}
                type="file"
                accept=".pdf"
                className="text-xs mt-1 block"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPdf(f);
                }}
              />
            </div>
            <Button onClick={save} disabled={busy} className="gap-2">
              <Upload className="h-4 w-4" /> {busy ? "Saving…" : "Save guidelines"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
