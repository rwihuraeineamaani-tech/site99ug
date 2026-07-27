export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-5 overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-[3px] bg-site-red/70" />
      <div className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className="display text-3xl mt-2 tabular-nums">{value}</div>
      {hint && <div className="mono text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  const tone =
    s === "paid"
      ? "border-site-red text-site-red"
      : s === "pending"
      ? "border-foreground/30 text-foreground"
      : "border-muted-foreground/40 text-muted-foreground";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 mono text-[9px] uppercase tracking-[0.2em] ${tone}`}>
      {status || "—"}
    </span>
  );
}

export default StatCard;
