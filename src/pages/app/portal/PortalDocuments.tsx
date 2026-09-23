import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Money, StatusChip } from "@/components/system";
import { toast } from "sonner";

type Contract = {
  id: string;
  title: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  value_ugx: number | null;
  file_path: string | null;
};

type Step = { id: string; title: string; status: string; due_on: string | null; notes: string | null };

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function PortalDocuments() {
  const { client, clientId, loading } = usePortalClient();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [ct, st] = await Promise.all([
        supabase
          .from("resident_contracts")
          .select("id, title, status, starts_on, ends_on, value_ugx, file_path")
          .eq("resident_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("resident_onboarding_steps")
          .select("id, title, status, due_on, notes")
          .eq("resident_id", clientId)
          .order("created_at"),
      ]);
      if (cancelled) return;
      setContracts((ct.data as Contract[]) ?? []);
      setSteps((st.data as Step[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("resident-contracts").createSignedUrl(path, 120);
    if (error || !data) return toast.error("We could not open that file. Ask your Site 99 contact.");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <PortalPage title="Documents" lede="Your agreements and the setup steps we agreed on." client={client} loading={loading}>
      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="Agreements" hint={`${contracts.length}`}>
          {contracts.length === 0 ? (
            <PortalEmpty>No agreements shared yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {contracts.map((c) => (
                <li key={c.id} className="rounded-xl border border-hairline px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">{c.title}</div>
                    <StatusChip value={c.status} />
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    {fmt(c.starts_on)} – {fmt(c.ends_on)}
                    {c.value_ugx ? " · " : ""}
                    {c.value_ugx ? <Money amount={c.value_ugx} className="text-ink" /> : null}
                  </div>
                  {c.file_path && (
                    <button onClick={() => openFile(c.file_path!)} className="mt-2 text-xs text-signal underline">
                      Open the document
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="Setting you up" hint={`${steps.length}`}>
          {steps.length === 0 ? (
            <PortalEmpty>Nothing outstanding.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {steps.map((s) => (
                <li key={s.id} className="rounded-xl border border-hairline px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">{s.title}</div>
                    <StatusChip value={s.status} />
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">Due {fmt(s.due_on)}</div>
                  {s.notes && <p className="mt-1 text-sm text-ink-soft">{s.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
