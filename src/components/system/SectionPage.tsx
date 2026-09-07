import { ReactNode } from "react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";

/** Shared page frame for the multi-tab departments (Legal, Management). */
export default function SectionPage({
  eyebrow,
  title,
  lede,
  path,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  path: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell eyebrow={eyebrow}>
      <Seo title={`${title.replace(/\.$/, "")} — ${eyebrow} — Site 99`} description={lede} path={path} noindex />
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} actions={actions} />
      {children}
    </AppShell>
  );
}
