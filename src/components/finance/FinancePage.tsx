import { ReactNode } from "react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";
import { FinanceLockProvider, FinanceLockChip, FinanceGate } from "@/components/finance/FinanceLock";

export default function FinancePage({
  title,
  lede,
  path,
  actions,
  /** Set false for pages that do not move money, so a PIN is not needed. */
  gate = true,
  children,
}: {
  title: string;
  lede: string;
  path: string;
  actions?: ReactNode;
  gate?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <Seo title={`${title} — Finance — Site 99`} description={lede} path={path} noindex />
      <PageHeader
        eyebrow="Finance"
        title={title}
        lede={lede}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {gate && <FinanceLockChip />}
            {actions}
          </div>
        }
      />
      {gate ? <FinanceGate>{children}</FinanceGate> : children}
    </>
  );

  return (
    <AppShell>
      {gate ? <FinanceLockProvider>{body}</FinanceLockProvider> : body}
    </AppShell>
  );
}
