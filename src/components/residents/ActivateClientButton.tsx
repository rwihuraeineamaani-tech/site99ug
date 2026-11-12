import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOnboardingPowers } from "@/components/residents/OnboardingPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Marks onboarding finished and recalculates the client's status. Server checks every step is done. */
export default function ActivateClientButton({ residentId, status, onDone }: { residentId: string; status?: string | null; onDone?: () => void }) {
  const { canRun } = useOnboardingPowers();
  const [busy, setBusy] = useState(false);
  const s = (status ?? "").toLowerCase();
  if (!canRun || s === "active" || s === "renewal due") return null;
  const go = async () => {
    if (!confirm("Activate this client? Every onboarding step must be complete or marked not needed.")) return;
    setBusy(true);
    const { data, error } = await db.rpc("activate_resident", { _resident_id: residentId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(data === "active" || data === "renewal_due" ? "Client is now active." : "Onboarding complete. Status will turn active once a contract is running.");
    onDone?.();
  };
  return (
    <button className="ctl ctl-solid eyebrow px-4 py-2 focus-ring" disabled={busy} onClick={go}>
      {busy ? "activating…" : "activate client"}
    </button>
  );
}
