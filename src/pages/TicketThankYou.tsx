import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

export default function TicketThankYou() {
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "failed" | "unknown">("checking");
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref =
      params.get("OrderMerchantReference") ||
      params.get("orderMerchantReference") ||
      sessionStorage.getItem("site99_last_ref");
    if (!ref) {
      setStatus("unknown");
      return;
    }
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 12 && !cancelled; i++) {
        const { data } = await supabase.rpc("get_order_summary", { _ref: ref });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setSummary(row);
          if (row.status === "paid") return setStatus("paid");
          if (row.status === "failed" || row.status === "cancelled") return setStatus("failed");
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!cancelled) setStatus("pending");
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout>
      <Seo title="Payment — Site 99" description="Payment confirmation" path="/tickets/thank-you" />
      <section className="pt-36 pb-24 px-8 md:px-16 min-h-[80vh]">
        <div className="max-w-2xl">
          <div className="mono text-xs uppercase tracking-[0.3em] text-site-red mb-6">Transmission</div>
          {status === "checking" && <h1 className="display text-5xl">Confirming payment…</h1>}
          {status === "paid" && (
            <>
              <h1 className="display text-6xl">Confirmed. <span className="text-site-red">See you there.</span></h1>
              <p className="mt-6 text-muted-foreground">
                Your {summary?.ticket_count} ticket{summary?.ticket_count > 1 ? "s" : ""} for <strong>{summary?.event_title}</strong> {" "}
                are on their way to <strong>{summary?.buyer_email}</strong>. Bring the QR to the gate.
              </p>
            </>
          )}
          {status === "pending" && (
            <>
              <h1 className="display text-5xl">Still processing.</h1>
              <p className="mt-4 text-muted-foreground">Mobile Money can take a minute. We'll email your tickets the moment it clears.</p>
            </>
          )}
          {status === "failed" && (
            <>
              <h1 className="display text-5xl">Payment failed.</h1>
              <p className="mt-4 text-muted-foreground">No charge was completed. You can try again.</p>
            </>
          )}
          {status === "unknown" && <h1 className="display text-5xl">No order reference found.</h1>}
          <Link to="/events" className="inline-block mt-10 mono text-xs uppercase tracking-[0.3em] border-b border-site-red pb-1" data-hover>
            ← Back to events
          </Link>
        </div>
      </section>
    </Layout>
  );
}
