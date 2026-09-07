import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MyAssignment = { resident_id: string; kind: "contact" | "handler" };

/** Clients this person is on — one contact role, any number of handler roles. */
export function useMyAssignments() {
  const [rows, setRows] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("client_assignments").select("resident_id, kind");
      if (cancelled) return;
      setRows((data as unknown as MyAssignment[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isContact = (residentId: string | null | undefined) =>
    !!residentId && rows.some((r) => r.resident_id === residentId && r.kind === "contact");
  const isHandler = (residentId: string | null | undefined) =>
    !!residentId && rows.some((r) => r.resident_id === residentId && r.kind === "handler");

  return { assignments: rows, loading, isContact, isHandler };
}

export default useMyAssignments;
