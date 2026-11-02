type Item = string | { name: string; territory?: string; logo?: string };

interface Props {
  items: Item[];
  className?: string;
}

export const Marquee = ({ items, className = "" }: Props) => {
  const doubled = [...items, ...items];
  return (
    <div className={`overflow-hidden py-3 md:py-4 ${className}`}>
      <div className="marquee-track flex items-center gap-12 w-max will-change-transform">
        {doubled.map((t, i) => {
          const name = typeof t === "string" ? t : t.name;
          const logo = typeof t === "string" ? undefined : t.logo;
          const territory =
            typeof t === "string" ? undefined : t.territory?.trim() || undefined;
          return (
            <div key={i} className="flex items-center gap-16 shrink-0">
              {logo ? (
                <div className="flex flex-col items-center">
                  <div className="flex h-20 w-40 md:h-24 md:w-48 items-center justify-center rounded-2xl border border-rule bg-card p-3 shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-md">
                  <img
                    src={logo}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                  </div>
                  <div className="mono text-[11px] md:text-xs uppercase tracking-[0.22em] text-site-red mt-2 whitespace-nowrap">
                    {name}
                  </div>
                </div>
              ) : (
                <div className="leading-tight">
                  <div className="display text-2xl md:text-3xl lg:text-4xl whitespace-nowrap">
                    {name}
                  </div>
                  <div className="mono text-[11px] md:text-xs uppercase tracking-[0.22em] text-site-red mt-2 whitespace-nowrap min-h-[1em]">
                    {territory || "\u00A0"}
                  </div>
                </div>
              )}
              <span className="text-site-red text-lg">●</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
