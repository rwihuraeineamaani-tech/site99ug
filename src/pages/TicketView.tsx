import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Layout } from "@/components/Layout";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

export default function TicketView() {
  const { token } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_ticket_by_token", { _token: token }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      setTicket(row);
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (ticket && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, ticket.qr_token, { width: 320, margin: 1 });
    }
  }, [ticket]);

  return (
    <Layout hideFooter>
      <Seo title={ticket ? `Ticket — ${ticket.event_title}` : "Ticket — Site 99"} description="Your Site 99 event ticket" path={`/t/${token}`} />
      <section className="min-h-screen flex items-center justify-center px-8 md:px-16 pt-28 pb-16">
        <div className="w-full max-w-md border border-border rounded-lg p-8 bg-background">
          {loading && <p className="mono text-xs">Loading…</p>}
          {!loading && !ticket && (
            <>
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Not Found</div>
              <p className="mt-4">This ticket link is invalid or the payment hasn't cleared yet.</p>
            </>
          )}
          {ticket && (
            <>
              <div className="mono text-xs uppercase tracking-[0.3em] text-site-red">Site 99 Ticket</div>
              <h1 className="display text-3xl mt-2 leading-tight">{ticket.event_title}</h1>
              <div className="mt-2 mono text-xs text-muted-foreground">
                {new Date(ticket.event_starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>
              {ticket.event_venue && <div className="text-sm mt-1">{ticket.event_venue}</div>}
              <div className="my-6 flex justify-center bg-white p-4 rounded">
                <canvas ref={canvasRef} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mono uppercase tracking-[0.2em]">
                <div><div className="text-muted-foreground">Tier</div><div>{ticket.tier_name}</div></div>
                <div><div className="text-muted-foreground">Status</div><div className={ticket.status === "used" ? "text-site-red" : ""}>{ticket.status}</div></div>
                {ticket.holder_name && <div className="col-span-2"><div className="text-muted-foreground">Holder</div><div>{ticket.holder_name}</div></div>}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
