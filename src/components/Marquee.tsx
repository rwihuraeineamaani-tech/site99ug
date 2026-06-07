type Item = string | { name: string; territory?: string };

interface Props {
  items: Item[];
  className?: string;
}

export const Marquee = ({ items, className = "" }: Props) => {
  const doubled = [...items, ...items];
  return (
    <div className={`overflow-hidden whitespace-nowrap py-2 ${className}`}>
      <div className="marquee-track inline-flex items-center gap-16 will-change-transform">
        {doubled.map((t, i) => {
          const name = typeof t === "string" ? t : t.name;
          const territory = typeof t === "string" ? undefined : t.territory;
          return (
            <span key={i} className="inline-flex items-center gap-16">
              <span className="inline-flex flex-col leading-[1.05] py-1">
                <span className="display text-fluid-lg">{name}</span>
                {territory && (
                  <span className="mono text-[10px] md:text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">
                    {territory}
                  </span>
                )}
              </span>
              <span className="text-site-red">●</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
