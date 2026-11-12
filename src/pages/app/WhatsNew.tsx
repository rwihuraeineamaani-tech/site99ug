import AppShell from "@/components/system/AppShell";
import Seo from "@/components/Seo";
import { PageHeader } from "@/components/system";
import { RELEASES } from "@/lib/version";

export default function WhatsNew() {
  return (
    <AppShell eyebrow="Site 99">
      <Seo title="What's new · Site 99" description="Every Site 99 release in plain English." path="/app/whats-new" noindex />
      <PageHeader eyebrow="Site 99" title="What's new." lede="Every release of the system, newest first." />
      <div className="max-w-3xl space-y-4">
        {RELEASES.map((r) => (
          <article key={r.version} className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Version {r.version} · {r.title}</h2>
              <span className="num text-xs text-ink-faint">{new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              {r.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
