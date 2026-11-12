import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage from "@/components/portal/PortalPage";
import ClientFiles from "@/components/clientspace/ClientFiles";

export default function PortalFiles() {
  const { client, loading } = usePortalClient();
  return (
    <PortalPage title="Brand files" lede="Send us your logos, product photos and price lists. Your team gets them straight away." client={client} loading={loading}>
      {client && <ClientFiles residentId={client.id} />}
    </PortalPage>
  );
}
