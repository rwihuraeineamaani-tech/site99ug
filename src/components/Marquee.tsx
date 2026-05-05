interface Props {
  items: string[];
  className?: string;
}
export const Marquee = ({ items, className = "" }: Props) => {
  const doubled = [...items, ...items];
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div className="marquee-track inline-flex gap-16 will-change-transform">
        {doubled.map((t, i) => (
          <span key={i} className="display text-fluid-lg inline-flex items-center gap-16">
            {t}
            <span className="text-site-red">●</span>
          </span>
        ))}
      </div>
    </div>
  );
};
