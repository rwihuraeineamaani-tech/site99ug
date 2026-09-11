import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Client = {
  id: string;
  name: string;
  primary_phone: string | null;
  primary_email: string | null;
  category: string;
  status: string;
};

export default function ClientPortal() {
  const { clientId } = useMyRoles();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("residents")
        .select("id, name, primary_phone, primary_email, category, status")
        .eq("id", clientId ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      if (cancelled) return;
      setClient((data as Client) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <AppShell eyebrow="Client portal">
      <Seo title="Client portal — Site 99" description="Your Site 99 engagement." path="/portal" noindex />
      <PageHeader
        eyebrow="Client portal"
        title={loading ? "Loading…" : client?.name ?? "Your engagement"}
        lede="Everything Site 99 is doing for you, in one place. You only ever see your own engagement."
        actions={client ? <div className="flex items-center gap-2"><Link to="/portal/chat"><Button size="sm" className="gap-2"><MessageCircle className="h-4 w-4" /> Chat</Button></Link><StatusChip value={client.status} /></div> : undefined}
      />

      {!loading && !client && (
        <div className="surface rounded-sm p-10 text-center text-sm text-ink-soft">
          Your account isn’t linked to an engagement yet. Ask your Site 99 contact to finish the invite.
        </div>
      )}

      {client && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="surface rounded-2xl p-5">
              <div className="eyebrow text-ink-faint">Main contact</div>
               <div className="mt-2">{client.primary_email || "—"}</div>
               <div className="text-sm text-ink-soft">{client.primary_phone || ""}</div>
            </div>
            <div className="surface rounded-2xl p-5">
              <div className="eyebrow text-ink-faint">Category</div>
              <div className="mt-2 capitalize">{client.category}</div>
            </div>
            <div className="surface rounded-2xl p-5">
              <div className="eyebrow text-ink-faint">Status</div>
              <div className="mt-2">
                <StatusChip value={client.status} />
              </div>
            </div>
          </div>

          <div className="mt-12">
            <SectionHeading index="01" title="Coming next" hint="Phase 7" />
            <p className="text-sm text-ink-soft max-w-2xl">
              Your contract status and timeline, deliverables, content calendar and invoices appear here as those
              modules go live.
            </p>
          </div>
        </>
      )}
    </AppShell>
  );
}
