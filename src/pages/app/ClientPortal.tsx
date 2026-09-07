import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";

type Client = {
  id: string;
  name: string;
  contact_person: string | null;
  contact_email: string | null;
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
        .from("clients")
        .select("id, name, contact_person, contact_email, category, status")
        .limit(1)
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
        actions={client ? <StatusChip value={client.status} /> : undefined}
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
              <div className="mt-2">{client.contact_person || "—"}</div>
              <div className="text-sm text-ink-soft">{client.contact_email || ""}</div>
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
