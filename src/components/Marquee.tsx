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
    <div className={`logo-strip overflow-hidden py-4 md:py-6 ${className}`}>
      <div className="marquee-track flex items-center gap-10 md:gap-16 w-max will-change-transform">
        {doubled.map((t, i) => (
          <img
            key={i}
            src={t.logo}
            alt={t.name}
            title={t.name}
            loading="lazy"
            draggable={false}
            className="h-16 w-auto max-w-[340px] shrink-0 select-none object-contain md:h-24"
          />
        ))}
      </div>
    </div>
  );
};
