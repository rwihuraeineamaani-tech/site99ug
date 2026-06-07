type Item = string | { name: string; territory?: string };

interface Props {
  items: Item[];
  className?: string;
}

export const Marquee = ({ items, className = "" }: Props) => {
  const doubled = [...items, ...items];
  return (
    <div className={`overflow-hidden py-6 md:py-8 ${className}`}>
      <div className="marquee-track flex items-center gap-20 w-max will-change-transform">
        {doubled.map((t, i) => {
          const name = typeof t === "string" ? t : t.name;
          const territory = typeof t === "string" ? undefined : t.territory;
          return (
            <div key={i} className="flex items-center gap-20 shrink-0">
              <div className="flex flex-col leading-tight">
                <span className="display text-2xl md:text-3xl lg:text-4xl whitespace-nowrap">
                  {name}
                </span>
                {territory && (
                  <span className="mono text-[11px] md:text-xs uppercase tracking-[0.22em] text-site-red/80 mt-2 whitespace-nowrap">
                    {territory}
                  </span>
                )}
              </div>
              <span className="text-site-red text-lg">●</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
