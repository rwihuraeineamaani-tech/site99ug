import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { CapabilityScroll } from "@/components/ai/CapabilityScroll";

type System = { title: string; copy: string; replaces: string; phase: string };

const groups: { group: string; blurb: string; items: System[] }[] = [
  {
    group: "Business systems",
    blurb: "The operational backbone — the things a business runs on every day.",
    items: [
      { title: "School management", copy: "Students, fees, attendance, results and parent comms in one console.", replaces: "Registers, fee books, WhatsApp groups", phase: "4–8 weeks" },
      { title: "Inventory & stock", copy: "Live stock levels, reorder alerts, supplier records, movement history.", replaces: "Stock sheets, manual counts", phase: "3–6 weeks" },
      { title: "Point of sale", copy: "Fast checkout, receipts, daily Z-reports, multi-branch totals.", replaces: "Cash books, standalone tills", phase: "4–7 weeks" },
      { title: "CRM & sales pipeline", copy: "Leads, follow-ups, deal stages and reminders that actually fire.", replaces: "Contact lists, memory", phase: "3–5 weeks" },
      { title: "Invoicing & billing", copy: "Recurring invoices, payment tracking, statements, overdue chasing.", replaces: "Word templates, manual chasing", phase: "2–4 weeks" },
      { title: "HR & payroll", copy: "Staff records, leave, timesheets, payslips and statutory summaries.", replaces: "Spreadsheets, paper leave forms", phase: "5–8 weeks" },
      { title: "Logistics & dispatch", copy: "Jobs, drivers, routes, proof of delivery and delivery status pages.", replaces: "Phone calls, delivery notes", phase: "4–7 weeks" },
      { title: "Bookings & scheduling", copy: "Availability, online booking, confirmations and no-show reminders.", replaces: "Diary books, back-and-forth DMs", phase: "2–4 weeks" },
    ],
  },
  {
    group: "Digital products",
    blurb: "Customer-facing platforms built to carry a brand and take money.",
    items: [
      { title: "Event ticketing", copy: "Tiers, mobile money checkout, QR tickets and gate scanning.", replaces: "Paper tickets, manual lists", phase: "Live at Site 99" },
      { title: "Marketplaces", copy: "Multi-vendor listings, orders, payouts and vendor dashboards.", replaces: "Instagram DM ordering", phase: "8–12 weeks" },
      { title: "Membership platforms", copy: "Tiers, renewals, gated content and member directories.", replaces: "Manual member registers", phase: "4–7 weeks" },
      { title: "Learning platforms", copy: "Courses, lessons, progress tracking, certificates and cohorts.", replaces: "Drive folders", phase: "6–10 weeks" },
      { title: "Client & customer portals", copy: "A private login where clients see their own files, status and invoices.", replaces: "Email threads", phase: "3–6 weeks" },
      { title: "Campaign sites", copy: "Fast, brand-led launch sites wired to analytics and lead capture.", replaces: "Static PDFs and flyers", phase: "1–3 weeks" },
    ],
  },
  {
    group: "Automation layers",
    blurb: "The quiet layer on top of what you already run — no rip-and-replace.",
    items: [
      { title: "AI chatbots", copy: "Trained on your own docs, answering customers around the clock.", replaces: "Repeat manual replies", phase: "2–4 weeks" },
      { title: "WhatsApp automations", copy: "Order confirmations, reminders, broadcasts and support routing.", replaces: "Manual messaging", phase: "2–4 weeks" },
      { title: "Document & PDF generation", copy: "Contracts, tickets, certificates and reports generated on trigger.", replaces: "Hand-filled templates", phase: "1–3 weeks" },
      { title: "Data entry automation", copy: "Pull data from forms, emails and files straight into your systems.", replaces: "Retyping", phase: "2–4 weeks" },
      { title: "Reporting dashboards", copy: "One live screen for the numbers leadership actually asks for.", replaces: "Weekly spreadsheet builds", phase: "2–5 weeks" },
      { title: "API & tool integrations", copy: "Make your existing tools talk to each other, both directions.", replaces: "Copy-paste between systems", phase: "1–4 weeks" },
      { title: "Admin consoles", copy: "Role-based internal tooling so teams stop touching the database.", replaces: "Ad-hoc access", phase: "3–6 weeks" },
      { title: "Approval workflows", copy: "Requests routed, escalated and logged with a full audit trail.", replaces: "Signature chasing", phase: "2–5 weeks" },
    ],
  },
];

export default function AISystems() {
  return (
    <>
      <Seo
        title="Systems We Build — Site 99 AI & Automations"
        description="The full catalogue of systems Site 99 builds: school management, inventory, POS, CRM, ticketing, portals, dashboards, chatbots and custom automations."
        path="/ai-automations/systems"
      />

      <section className="px-4 pb-10 pt-20 sm:px-8 md:px-16 md:pt-28">
        <span className="tech text-[10px] uppercase tracking-[0.28em] text-white/45">Sector catalogue</span>
        <h1 className="display mt-4 text-[clamp(2.4rem,8vw,5.5rem)] font-black leading-[0.95]">Systems</h1>
        <p className="mt-6 max-w-2xl text-fluid-md text-white/65">
          Anything a business runs on paper, in a spreadsheet, or in someone's head can be a system. Here's what we
          build most — and if it's not listed, we build it custom.
        </p>
      </section>

      <section className="border-t border-white/10 py-10">
        <CapabilityScroll />
      </section>

      {groups.map((g) => (
        <section key={g.group} className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-2xl md:text-4xl">{g.group}</h2>
            <p className="tech max-w-md text-[11px] uppercase tracking-[0.2em] text-white/40">{g.blurb}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {g.items.map((s, i) => (
              <motion.article
                key={s.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
                className="flex flex-col justify-between gap-6 border border-white/12 bg-black p-6 transition-colors hover:border-white/40"
              >
                <div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{s.copy}</p>
                </div>
                <dl className="grid gap-2 border-t border-white/10 pt-4">
                  <div className="flex justify-between gap-4">
                    <dt className="tech text-[10px] uppercase tracking-[0.2em] text-white/35">Replaces</dt>
                    <dd className="text-right text-[11px] text-white/60">{s.replaces}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="tech text-[10px] uppercase tracking-[0.2em] text-white/35">Typical build</dt>
                    <dd className="text-right text-[11px] text-white/60">{s.phase}</dd>
                  </div>
                </dl>
              </motion.article>
            ))}
          </div>
        </section>
      ))}

      <section className="border-t border-white/10 px-4 py-20 text-center sm:px-8 md:px-16 md:py-28">
        <p className="display text-2xl md:text-4xl">Not on the list?</p>
        <p className="mx-auto mt-4 max-w-lg text-white/60">
          Most of what we ship is custom. Tell us the process and we'll map the system around it.
        </p>
        <Link
          to="/ai-automations/contact"
          className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition-colors hover:bg-white/85"
        >
          Start a build
        </Link>
      </section>
    </>
  );
}
