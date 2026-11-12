import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage from "@/components/portal/PortalPage";
import ClientReports from "@/components/clientspace/ClientReports";

export default function PortalReports() {
  const { client, loading } = usePortalClient();
  return (
    <PortalPage title="Monthly reports" lede="Your results each month: the report from your team plus live numbers on what we posted, shot and reached." client={client} loading={loading}>
      {client && <ClientReports residentId={client.id} clientName={client.name} />}
    </PortalPage>
  );
}
