import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";

type State = "checking" | "ready" | "done" | "used" | "invalid";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.ok && body?.valid !== false) setState(body?.used ? "used" : "ready");
        else setState(body?.used ? "used" : "invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setBusy(false);
    setState(error ? "invalid" : "done");
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-8 md:px-16">
      <Seo title="Unsubscribe — Site 99" description="Stop receiving emails from Site 99." path="/unsubscribe" noindex />
      <div className="w-full max-w-md rounded-2xl border border-rule bg-paper-raised p-8">
        <p className="eyebrow text-ink-faint">Site 99</p>
        <h1 className="mt-2 text-2xl font-semibold">Email preferences</h1>

        {state === "checking" && <p className="mt-4 text-sm text-ink-soft">Checking your link…</p>}

        {state === "ready" && (
          <>
            <p className="mt-4 text-sm text-ink-soft">
              Confirm and we'll stop sending you emails from Site 99. Sign-in and password emails still work.
            </p>
            <Button className="mt-6" disabled={busy} onClick={confirm}>
              {busy ? "Working…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}

        {state === "done" && <p className="mt-4 text-sm text-ink-soft">Done — you're unsubscribed.</p>}
        {state === "used" && <p className="mt-4 text-sm text-ink-soft">You're already unsubscribed. Nothing more to do.</p>}
        {state === "invalid" && (
          <p className="mt-4 text-sm text-ink-soft">This link isn't valid any more. Reply to any of our emails and we'll sort it out.</p>
        )}
      </div>
    </main>
  );
}
