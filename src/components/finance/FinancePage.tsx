import { ReactNode } from "react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";

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
      <Seo title={`${title} — Finance — Site 99`} description={lede} path={path} noindex />
      <PageHeader eyebrow="Finance" title={title} lede={lede} actions={actions} />
      {children}
    </AppShell>
  );
}
