import { ReactNode } from "react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";
import { FinanceLockProvider, FinanceLockChip } from "@/components/finance/FinanceLock";

export default function FinancePage({
  title,
  lede,
  path,
  actions,
  children,
}: {
  title: string;
  lede: string;
  path: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <FinanceLockProvider>
        <Seo title={`${title} — Finance — Site 99`} description={lede} path={path} noindex />
        <PageHeader
          eyebrow="Finance"
          title={title}
          lede={lede}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FinanceLockChip />
              {actions}
            </div>
          }
        />
        {children}
      </FinanceLockProvider>
    </AppShell>
  );
}
