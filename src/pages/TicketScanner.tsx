import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

export default function TicketScanner() {
  const [status, setStatus] = useState<"idle" | "scanning" | "checking">("idle");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const start = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("You must be signed in as an admin.");
        return;
      }
      const el = document.getElementById("qr-reader");
      if (!el) return;
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decoded) => {
            if (busyRef.current) return;
            busyRef.current = true;
            setStatus("checking");
            try {
              const { data: res, error } = await supabase.functions.invoke("ticket-scan", {
                body: { qrToken: decoded },
              });
              if (error) throw error;
              setResult(res);
            } catch (e: any) {
              setResult({ ok: false, reason: e.message });
            }
            setTimeout(() => {
              busyRef.current = false;
              setStatus("scanning");
            }, 1500);
          },
          () => {}
        );
        setStatus("scanning");
      } catch (e: any) {
        setError(e.message || "Camera unavailable");
      }
    };
    start();
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <Layout hideFooter>
      <Seo title="Ticket Scanner — Site 99" description="Scan event tickets" path="/admin/scan" />
      <section className="pt-28 pb-16 px-8 md:px-16">
        <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Admin</div>
        <h1 className="display text-5xl mt-2">Ticket Scanner</h1>

        <div className="mt-8 grid md:grid-cols-2 gap-8 max-w-4xl">
          <div id="qr-reader" className="w-full aspect-square border border-border rounded-lg overflow-hidden" />
          <div className="border border-border rounded-lg p-6">
            <div className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Last scan</div>
            {error && <p className="mt-4 text-site-red">{error}</p>}
            {!result && !error && <p className="mt-4">Awaiting scan… ({status})</p>}
            {result?.ok && (
              <>
                <div className="mt-4 display text-3xl text-site-red">Admit</div>
                <div className="mt-2 mono text-xs">{result.ticket?.tier?.name} — {result.ticket?.tier?.event?.title}</div>
                {result.ticket?.holder_name && <div className="text-sm mt-1">{result.ticket.holder_name}</div>}
              </>
            )}
            {result && !result.ok && (
              <>
                <div className="mt-4 display text-3xl text-site-red">Reject</div>
                <div className="mt-2 mono text-xs uppercase tracking-[0.2em]">{result.reason}</div>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
