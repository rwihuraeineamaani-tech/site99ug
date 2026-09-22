import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

export type PortalClient = {
  id: string;
  name: string;
  primary_phone: string | null;
  primary_email: string | null;
  category: string;
  status: string;
};

/** Loads the resident (client) record linked to the signed-in portal user. */
export function usePortalClient() {
  const { clientId } = useMyRoles();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("residents")
      .select("id, name, primary_phone, primary_email, category, status")
      .eq("id", clientId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    setClient((data as PortalClient) ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { client, clientId: client?.id ?? clientId ?? null, loading, reload: load };
}
