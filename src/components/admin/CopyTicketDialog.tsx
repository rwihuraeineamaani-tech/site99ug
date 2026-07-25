import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PUBLIC_SITE = "https://site99ug.com";

type Props = {
  orderId: string | null;
  onClose: () => void;
};

async function copy(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed");
  }
}

export default function CopyTicketDialog({ orderId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!orderId) { setData(null); return; }
    (async () => {
      setLoading(true);
      const { data: order } = await supabase
        .from("orders")
        .select("id, buyer_name, buyer_email, buyer_phone, amount_ugx, pesapal_merchant_reference, manual_tid, event_id")
        .eq("id", orderId).single();
      if (!order) { setLoading(false); return; }
      const { data: event } = await supabase
        .from("events")
        .select("title, venue, starts_at, organizer_name, organizer_socials, sender_from_name, sender_from_email")
        .eq("id", order.event_id).single();
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, holder_name, qr_token, ticket_tiers(name)")
        .eq("order_id", order.id);
      setData({ order, event, tickets: tickets || [] });
      setLoading(false);
    })();
  }, [orderId]);

  if (!orderId) return null;

  const composed = (() => {
    if (!data) return { subject: "", body: "", to: "" };
    const { order, event, tickets } = data;
    const whenText = event?.starts_at
      ? new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })
      : "";
    const links = tickets.map((t: any) => ({
      name: t.ticket_tiers?.name || "Ticket",
      holder: t.holder_name || order.buyer_name,
      url: `${PUBLIC_SITE}/t/${t.qr_token}`,
    }));
    const socials = Array.isArray(event?.organizer_socials) ? event.organizer_socials : [];
    const fromEmail = event?.sender_from_email || "office@site99ug.com";
    const subject = `Your ticket${tickets.length > 1 ? "s" : ""} — ${event?.title || ""}`;
    const body = [
      `Your ticket is confirmed — ${event?.title || ""}`,
      `${whenText}${event?.venue ? " · " + event.venue : ""}`,
      ``,
      `Hi ${order.buyer_name}, thanks for your purchase.`,
      `Your ${links.length > 1 ? links.length + " tickets are" : "ticket is"} available below. Show the QR at the gate.`,
      ``,
      ...links.map((l: any, i: number) => `Ticket ${i + 1} — ${l.name} · ${l.holder}\n${l.url}`),
      ``,
      `Links stay active for 60 days. Save them to your phone before the event.`,
      socials.length ? `\nFollow ${event?.organizer_name || "the organizer"}: ${socials.map((s: any) => `${s.label} ${s.url}`).join(" · ")}` : ``,
      ``,
      `No-reply notice from ${fromEmail}. For help: office@site99ug.com`,
    ].filter(Boolean).join("\n");
    return { subject, body, to: order.buyer_email };
  })();

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy ticket details for manual send</DialogTitle>
        </DialogHeader>

        {loading && <p className="mono text-xs text-muted-foreground">Loading…</p>}

        {!loading && data && (
          <div className="space-y-5">
            <Field label="To" value={composed.to} />
            <Field label="Subject" value={composed.subject} />

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email body (plain text)</div>
                <button onClick={() => copy(composed.body, "Email body copied")} className="mono text-[10px] uppercase bg-site-red text-site-white px-3 py-1 rounded" data-hover>Copy body</button>
              </div>
              <textarea readOnly value={composed.body} className="w-full h-56 border border-border rounded p-3 mono text-xs bg-background" />
            </div>

            <div>
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">QR code data (one per ticket)</div>
              <div className="space-y-3">
                {data.tickets.map((t: any, i: number) => {
                  const url = `${PUBLIC_SITE}/t/${t.qr_token}`;
                  return (
                    <div key={t.id} className="border border-border rounded p-3">
                      <div className="text-sm font-medium">
                        Ticket {i + 1} — {t.ticket_tiers?.name || "Ticket"} · {t.holder_name || data.order.buyer_name}
                      </div>
                      <div className="mt-2 space-y-2">
                        <RowCopy label="QR payload URL (encode this into the QR)" value={url} />
                        <RowCopy label="Raw token" value={t.qr_token} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => copy(`To: ${composed.to}\nSubject: ${composed.subject}\n\n${composed.body}`, "Full email copied")}
              className="w-full border border-site-red text-site-red mono text-xs uppercase py-2 rounded" data-hover>
              Copy everything (to + subject + body)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <button onClick={() => copy(value, `${label} copied`)} className="mono text-[10px] uppercase opacity-70 hover:opacity-100" data-hover>Copy</button>
      </div>
      <div className="border border-border rounded px-3 py-2 mono text-xs break-all">{value}</div>
    </div>
  );
}

function RowCopy({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-2 items-stretch">
        <input readOnly value={value} className="flex-1 border border-border rounded px-2 py-1 mono text-xs bg-background" />
        <button onClick={() => copy(value, "Copied")} className="mono text-[10px] uppercase bg-site-red text-site-white px-3 rounded" data-hover>Copy</button>
      </div>
    </div>
  );
}
