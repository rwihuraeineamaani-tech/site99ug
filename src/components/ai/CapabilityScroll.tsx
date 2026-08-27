const rowA = [
  "School management systems",
  "Inventory & stock control",
  "Point of sale",
  "Booking & scheduling",
  "CRM & sales pipelines",
  "Invoicing & payments",
  "HR and payroll",
  "Fleet & logistics tracking",
  "Membership & subscriptions",
  "Church / NGO management",
];

const rowB = [
  "Event ticketing platforms",
  "Customer support chatbots",
  "WhatsApp automations",
  "Document & PDF generation",
  "Reporting dashboards",
  "Data entry automation",
  "Client portals",
  "Marketplaces",
  "Learning platforms",
  "Internal admin consoles",
  "Landing pages & campaign sites",
  "API integrations between tools",
];

const Row = ({ items, dir }: { items: string[]; dir: "left" | "right" }) => {
  const doubled = [...items, ...items];
  return (
    <div className="group overflow-hidden py-2">
      <div
        className={`flex w-max items-center gap-4 md:gap-6 will-change-transform group-hover:[animation-play-state:paused] ${
          dir === "left" ? "ai-scroll-left" : "ai-scroll-right"
        }`}
      >
        {doubled.map((item, i) => (
          <div key={`${item}-${i}`} className="flex shrink-0 items-center gap-4 md:gap-6">
            <span className="whitespace-nowrap border border-white/15 px-4 py-2 text-sm md:text-base text-white/85">
              {item}
            </span>
            <span className="text-white/25 text-[10px]">●</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CapabilityScroll = () => (
  <div className="space-y-1">
    <Row items={rowA} dir="left" />
    <Row items={rowB} dir="right" />
  </div>
);
