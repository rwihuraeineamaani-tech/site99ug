interface Props {
  items: { name: string; logo: string }[];
  className?: string;
}

/** Scrolling wall of client logos. Logos are expected on white backgrounds. */
export const Marquee = ({ items, className = "" }: Props) => {
  if (!items.length) return null;
  // Repeat short lists so one half always fills a wide screen, then double for the seamless loop.
  const reps = Math.max(1, Math.ceil(8 / items.length));
  const half = Array.from({ length: reps }, () => items).flat();
  const doubled = [...half, ...half];
  return (
    <div className={`overflow-hidden py-3 md:py-4 ${className}`}>
      <div className="marquee-track flex items-center gap-6 md:gap-10 w-max will-change-transform">
        {doubled.map((t, i) => (
          <div
            key={i}
            className="flex h-20 w-40 md:h-24 md:w-48 shrink-0 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-md"
          >
            <img src={t.logo} alt={t.name} title={t.name} loading="lazy" className="h-full w-full object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
};
