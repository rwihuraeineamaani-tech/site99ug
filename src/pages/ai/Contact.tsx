import Seo from "@/components/Seo";
import { AILeadForm } from "@/components/ai/AILeadForm";

const next = [
  "We read it the same day and reply from info@site99ug.com.",
  "A short call — 20 minutes — to understand the process end to end.",
  "You get a written work map: what stays manual, what gets automated.",
  "A phased build path with timelines and cost before anything starts.",
];

export default function AIContact() {
  return (
    <>
      <Seo
        title="Request a Demo — Site 99 AI & Automations"
        description="Tell us what you'd like to automate. Site 99's AI & Automation sector replies with a work map and a phased build path."
        path="/ai-automations/contact"
      />

      <section className="px-4 pb-14 pt-20 sm:px-8 md:px-16 md:pt-28">
        <span className="tech text-[10px] uppercase tracking-[0.28em] text-white/45">Contact</span>
        <h1 className="display mt-4 text-[clamp(2.4rem,8vw,5.5rem)] font-black leading-[0.95]">Request a demo</h1>
        <p className="mt-6 max-w-xl text-fluid-md text-white/65">
          Tell us what you'd like to automate. We'll come back with a build path.
        </p>
      </section>

      <section className="border-t border-white/10 px-4 py-14 sm:px-8 md:px-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
          <AILeadForm idPrefix="contact" />

          <div className="flex flex-col gap-10">
            <div>
              <h2 className="tech text-[11px] uppercase tracking-[0.28em] text-white/50">What happens next</h2>
              <ol className="mt-6 grid gap-4">
                {next.map((n, i) => (
                  <li key={n} className="flex gap-4 border-b border-white/10 pb-4">
                    <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/35">0{i + 1}</span>
                    <span className="text-sm leading-relaxed text-white/65">{n}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border border-white/15 bg-black p-6">
              <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/40">Or email us directly</span>
              <a
                href="mailto:info@site99ug.com"
                className="mt-3 block text-lg font-semibold underline underline-offset-4 hover:text-white/80"
              >
                info@site99ug.com
              </a>
              <p className="mt-3 text-sm text-white/50">Kampala, Uganda · Site 99 UG LTD</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
