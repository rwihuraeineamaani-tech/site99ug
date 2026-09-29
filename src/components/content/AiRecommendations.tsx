import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

type Props = {
  title: string;
  type?: string | null;
  client?: string | null;
  platforms?: string[] | null;
  postedWhen?: string | null;
  brief?: string | null;
  metrics: Record<string, string>;
  note: string;
};

/** Sends a video's numbers to Lovable AI and shows practical next steps. */
export default function AiRecommendations(p: Props) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasNumbers = Object.values(p.metrics).some((v) => String(v ?? "").trim());

  const run = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("content-recommendations", {
      body: { ...p, platforms: (p.platforms ?? []).join(", ") },
    });
    setBusy(false);
    if (err) {
      let msg = "Couldn't get recommendations. Please try again.";
      try {
        const b = await (err as { context?: Response }).context?.json();
        if (b?.error) msg = b.error;
      } catch { /* keep default */ }
      setError(msg);
      return;
    }
    if (data?.error) return setError(data.error);
    setText(data?.text ?? null);
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-ink-faint">AI recommendations</div>
          <p className="text-xs text-ink-soft">Get ideas for the next videos based on these numbers.</p>
        </div>
        <Button size="sm" variant="outline" disabled={busy || !hasNumbers} onClick={run}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          {busy ? "Thinking…" : text ? "Ask again" : "Get recommendations"}
        </Button>
      </div>
      {!hasNumbers && <p className="mt-2 text-xs text-ink-soft">Fill in at least one number first.</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {text && (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {text.replace(/^#+\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1")}
        </div>
      )}
    </div>
  );
}
