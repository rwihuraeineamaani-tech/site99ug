import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 mb-6", className)}>{children}</div>
  );
}

const controlBase =
  "h-10 rounded-full border border-rule bg-paper-raised text-ink text-sm px-4 outline-none press " +
  "hover:border-ink focus:border-signal focus:ring-4 focus:ring-signal/10";

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
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(controlBase, "pl-10 placeholder:text-ink-faint min-w-[13rem] w-full")}
      />
    </div>
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
  const isAll = value === "all" || value === "";
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        controlBase,
        "pr-8 cursor-pointer appearance-none bg-[length:14px] bg-no-repeat bg-[right_0.9rem_center]",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23777%22 stroke-width=%223%22><path d=%22M6 9l6 6 6-6%22/></svg>')]",
        !isAll && "border-signal/50 bg-acc-violet-soft text-acc-violet font-semibold",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-paper-raised text-ink">
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
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className={cn(
        "relative inline-flex h-10 items-center rounded-full border border-rule bg-paper-sunken p-1",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-ink shadow-[0_2px_8px_-4px_hsl(var(--ink)/0.6)] transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 flex-1 eyebrow text-[10px] px-4 h-8 rounded-full transition-colors focus-ring",
            value === o.value ? "text-paper" : "text-ink-soft hover:text-ink"
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
