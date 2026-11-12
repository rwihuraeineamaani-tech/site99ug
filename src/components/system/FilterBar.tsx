import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-3 mb-6 flex max-w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:max-w-full sm:flex-wrap sm:px-0", className)}>{children}</div>
  );
}

/** One field language for every filter: a sunken well with a clear edge. */
const controlBase =
  "h-10 rounded-lg border border-input bg-paper-sunken text-ink text-sm px-3.5 outline-none transition-colors " +
  "hover:border-rule-strong focus:border-signal focus:ring-4 focus:ring-signal/15";

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
    <div className={cn("relative w-[min(82vw,20rem)] shrink-0 sm:w-auto sm:min-w-[13rem] sm:flex-1", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(controlBase, "w-full pl-10 placeholder:text-ink-faint")}
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
    <div className={cn("relative shrink-0", className)}>
      <select
        aria-label={label}
        title={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          controlBase,
          "filter-select w-full min-w-[9rem] cursor-pointer appearance-none pr-9 font-medium",
          !isAll && "border-signal/60 bg-signal/10 text-ink"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2", isAll ? "text-ink-faint" : "text-signal")}
      />
    </div>
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
        "no-scrollbar relative inline-flex h-10 max-w-full shrink-0 items-center overflow-x-auto rounded-lg border border-input bg-paper-sunken p-1",
        className
      )}
    >
      <span
        aria-hidden
        className="seg-thumb absolute top-1 bottom-1 left-1 rounded-md border border-rule-strong/40 bg-paper-overlay transition-transform duration-200 ease-out"
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
            "relative z-10 h-8 flex-1 whitespace-nowrap rounded-md px-3.5 text-[13px] font-semibold transition-colors focus-ring",
            value === o.value ? "text-ink" : "text-ink-faint hover:text-ink"
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
