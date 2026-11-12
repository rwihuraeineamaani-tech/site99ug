import { useState } from "react";
import { toast } from "sonner";

const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";

/** A small inline "send to" box: one client address per send. */
export function EmailDocButton({
  label,
  defaultTo,
  resolveDefault,
  send,
}: {
  label: string;
  defaultTo?: string | null;
  resolveDefault?: () => Promise<string | null>;
  send: (to: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo ?? "");
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  if (!open)
    return (
      <button
        className={pill}
        onClick={() => {
          setTo(defaultTo ?? "");
          setOpen(true);
          resolveDefault?.().then((e) => e && setTo((cur) => cur || e));
        }}
      >
        {label}
      </button>
    );

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="client@email.com"
        className="w-56 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs"
        autoFocus
      />
      <button
        className={`${pill} border-transparent bg-signal text-paper`}
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await send(to.trim());
            toast.success(`Sent to ${to.trim()}.`);
            setOpen(false);
          } catch {
            toast.error("It could not be sent. Email sending starts once the Site 99 email address finishes its setup check.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Send"}
      </button>
      <button className={pill} onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </button>
    </span>
  );
}
