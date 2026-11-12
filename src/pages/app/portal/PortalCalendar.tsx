import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage from "@/components/portal/PortalPage";
import ClientCalendar from "@/components/portal/ClientCalendar";

export default function PortalCalendar() {
  const { client, clientId, loading } = usePortalClient();
  return (
    <PortalPage title="Your calendar" lede="Your shoots and posts. Green is live, yellow is still being made, blue needs your approval. Tap a post to watch it, edit the caption, and check collabs and tags." client={client} loading={loading}>
      {clientId && <ClientCalendar residentId={clientId} />}
    </PortalPage>
  );
}
