import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading } from "@/components/system";

export type SoonProps = {
  eyebrow: string;
  title: string;
  lede: string;
  path: string;
  coming: string[];
  link?: { to: string; label: string };
};

export function DepartmentSoon({ eyebrow, title, lede, path, coming, link }: SoonProps) {
  return (
    <AppShell eyebrow={eyebrow}>
      <Seo title={`${eyebrow} — Site 99`} description={lede} path={path} noindex />
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />

      <SectionHeading index="01" title="What will live here" hint="Next up" />
      <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
        {coming.map((c) => (
          <li key={c} className="px-5 py-4 text-sm text-ink-soft flex items-baseline gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-state-pending shrink-0 translate-y-[-2px]" />
            {c}
          </li>
        ))}
      </ul>

      {link && (
        <div className="mt-8">
          <Link
            to={link.to}
            className="ctl eyebrow px-5 py-2.5 focus-ring"
          >
            {link.label} →
          </Link>
        </div>
      )}
    </AppShell>
  );
}

export default DepartmentSoon;
