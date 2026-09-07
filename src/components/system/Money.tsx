import { cn } from "@/lib/utils";

export function formatUGX(amount?: number | null, opts?: { compact?: boolean }) {
  const v = Number(amount ?? 0);
  if (opts?.compact && Math.abs(v) >= 1_000_000) return `UGX ${(v / 1_000_000).toFixed(1)}M`;
  if (opts?.compact && Math.abs(v) >= 1_000) return `UGX ${(v / 1_000).toFixed(0)}K`;
  return `UGX ${v.toLocaleString("en-UG")}`;
}

export function Money({
  amount,
  compact,
  className,
  signed,
}: {
  amount?: number | null;
  compact?: boolean;
  className?: string;
  signed?: boolean;
}) {
  const v = Number(amount ?? 0);
  return (
    <span
      className={cn(
        "num",
        signed && v < 0 && "text-state-stop",
        signed && v > 0 && "text-state-active",
        className
      )}
    >
      {signed && v > 0 ? "+" : ""}
      {formatUGX(v, { compact })}
    </span>
  );
}

export default Money;
