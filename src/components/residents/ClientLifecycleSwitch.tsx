import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/system";
import { clientTone } from "@/lib/contractLifecycle";

type Row = { resident_id: string; name: string; current_status: string | null; new_status: string; reason: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Founder-only: preview and switch on contract-driven client statuses. */
export default function ClientLifecycleSwitch({ canSwitch }: { canSwitch: boolean }) {
  const [enforced, setEnforced] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await db.from("contract_lifecycle_settings").select("enforce_client_status").maybeSingle();
    setEnforced(Boolean(data?.enforce_client_status));
  };
  useEffect(() => {
    load();
  }, []);

  const preview = async () => {
    const { data, error } = await db.rpc("preview_client_lifecycle");
    if (error) return toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setOpen(true);
  };

  const apply = async () => {
    setBusy(true);
    const { error } = await db.rpc("set_client_lifecycle_enforced", { _on: true });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Client statuses now follow contracts, onboarding and payments.");
    setOpen(false);
    load();
    window.location.reload();
  };

  if (enforced === null || enforced || !canSwitch) return null;
  const changes = rows.filter((r) => (r.current_status ?? "") !== r.new_status);

  return (
    <section className="surface rounded-2xl p-5 mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[16rem]">
          <div className="font-semibold text-sm">Let contracts decide every client's status</div>
          <p className="text-xs text-ink-soft mt-1">
            Clients with a contract already follow it. Switch this on so clients without a running signed contract stop showing as
            Active. See who changes first.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={preview}>
          See what changes
        </Button>
      </div>
      {open && (
        <div className="mt-4">
          {changes.length ? (
            <ul className="divide-y divide-rule surface-sunken rounded-xl">
              {changes.map((r) => (
                <li key={r.resident_id} className="px-4 py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1 min-w-[10rem] font-semibold">{r.name}</span>
                  <StatusChip value={r.current_status ?? "—"} tone={clientTone(r.current_status)} />
                  <span className="text-ink-faint">→</span>
                  <StatusChip value={r.new_status} tone={clientTone(r.new_status)} />
                  <span className="w-full text-[11px] text-ink-soft">{r.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nobody changes.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={apply}>
              {busy ? "Switching on…" : "Switch it on"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
