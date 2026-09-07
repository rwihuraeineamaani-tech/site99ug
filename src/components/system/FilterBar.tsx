import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 mb-5", className)}>{children}</div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "surface rounded-sm px-3 py-2 text-sm bg-paper-raised text-ink placeholder:text-ink-faint focus-ring outline-none min-w-[12rem]",
        className
      )}
    />
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "surface rounded-sm px-3 py-2 text-sm bg-paper-raised text-ink focus-ring outline-none",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-sm border border-rule overflow-hidden", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "eyebrow px-3 py-2 transition-colors focus-ring",
            value === o.value
              ? "bg-ink text-paper"
              : "bg-paper-raised text-ink-soft hover:bg-paper-sunken"
          )}
        >
          {o.label}
          {typeof o.count === "number" && <span className="ml-1.5 num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default FilterBar;
