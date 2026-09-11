import { useState } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, Lightbulb } from "lucide-react";
import { helpFor } from "@/lib/help";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** A help button on every page: what this page is for and how to handle it. */
export default function HelpButton() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const guide = helpFor(pathname);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        title="Help"
        aria-label="Help with this page"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rule text-ink-soft hover:border-signal/50 hover:text-signal focus-ring"
      >
        <HelpCircle className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-paper-raised text-ink">
        <SheetHeader className="text-left">
          <SheetTitle>{guide.title}</SheetTitle>
          <SheetDescription className="text-ink-soft">{guide.what}</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <h3 className="eyebrow mb-3 text-ink-faint">How to handle this page</h3>
          <ol className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-acc-violet-soft text-[11px] font-semibold text-acc-violet">{i + 1}</span>
                <span className="text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        {guide.tips?.length ? (
          <div className="mt-6 rounded-md border border-rule bg-paper-sunken p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Lightbulb className="h-4 w-4 text-acc-lime" />Good to know</div>
            <ul className="space-y-2 text-sm text-ink-soft">{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </div>
        ) : null}
        <p className="mt-6 text-xs text-ink-faint">Still stuck? Message a leader in Chat and point them at this page.</p>
      </SheetContent>
    </Sheet>
  );
}
