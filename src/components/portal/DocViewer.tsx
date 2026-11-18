import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ViewDoc = { title: string; filename: string; load: () => Promise<Blob> };

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens a document inside the page, with Download and open-in-tab buttons. */
export default function DocViewer({ doc, onClose }: { doc: ViewDoc | null; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setBlob(null); setUrl(null); setErr(null);
    if (!doc) return;
    let u: string | null = null;
    doc.load().then((b) => { setBlob(b); u = URL.createObjectURL(b); setUrl(u); }).catch((e) => setErr(e?.message ?? "Could not open this document."));
    return () => { if (u) setTimeout(() => URL.revokeObjectURL(u!), 30_000); };
  }, [doc]);
  const type = blob?.type ?? "";
  const isPdf = type.includes("pdf") || doc?.filename.toLowerCase().endsWith(".pdf");
  const isImg = type.startsWith("image/");
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-4 sm:p-5">
        <DialogHeader><DialogTitle className="pr-8 text-base">{doc?.title}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!blob} onClick={() => blob && doc && saveBlob(blob, doc.filename)}><Download className="h-4 w-4" /> Download</Button>
          <Button size="sm" variant="outline" disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")}><ExternalLink className="h-4 w-4" /> Open full screen</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-hairline bg-paper-sunken">
          {err ? <p className="p-6 text-sm text-destructive">{err}</p>
            : !url ? <p className="p-6 text-sm text-ink-faint">Opening…</p>
            : isImg ? <img src={url} alt={doc?.title} className="mx-auto max-h-full max-w-full object-contain" />
            : isPdf ? <iframe src={url} title={doc?.title} className="h-full w-full" />
            : <p className="p-6 text-sm text-ink-soft">This file type can't be shown here. Use Download to open it.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
