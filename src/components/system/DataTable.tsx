import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty = "Nothing here yet.",
  loading,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const alignClass = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (loading) {
    return (
      <div className="surface rounded-xl divide-y divide-rule overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse surface-sunken" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="surface rounded-xl p-12 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-acc-violet-soft grid place-items-center text-acc-violet text-lg">
          ✳
        </div>
        <p className="text-sm text-ink-soft">{empty}</p>
      </div>
    );
  }

  return (
    <div className={cn("surface rounded-xl overflow-hidden", className)}>
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="rule-b bg-paper-sunken/70">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "eyebrow text-ink-faint font-semibold px-4 py-3 whitespace-nowrap",
                  alignClass(c.align),
                  c.hideOnMobile && "hidden md:table-cell"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-acc-violet-soft/60"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-3.5 align-middle",
                    alignClass(c.align),
                    c.hideOnMobile && "hidden md:table-cell"
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}


export default DataTable;
