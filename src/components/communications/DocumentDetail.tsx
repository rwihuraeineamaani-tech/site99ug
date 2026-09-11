import { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Download, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DocumentDetail({ backTo, backLabel, kind, title, body, date, metadata, fileUrl, actions }: {
  backTo: string;
  backLabel: string;
  kind: string;
  title: string;
  body: string | null;
  date: string;
  metadata?: ReactNode;
  fileUrl?: string | null;
  actions?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-5">
        <Link to={backTo} className="inline-flex items-center gap-2 rounded-md text-sm text-ink-soft hover:text-ink focus-ring">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <header className="border-b border-rule py-8 md:py-12">
        <div className="eyebrow text-signal">{kind}</div>
        <h1 className="display mt-3 max-w-3xl text-4xl leading-tight md:text-6xl">{title}</h1>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-ink-faint">
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</span>
          {metadata}
        </div>
      </header>
      <div className="py-8 md:py-12">
        <div className="whitespace-pre-wrap text-base leading-8 text-ink-soft md:text-lg">{body || "No additional notes were added."}</div>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-10 inline-block">
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Open attachment <ExternalLink className="h-3.5 w-3.5" /></Button>
          </a>
        )}
      </div>
    </article>
  );
}
