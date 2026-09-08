/** A tiny eight-week shape line. Purely decorative — the figures carry the meaning. */
export default function Sparkline({
  points,
  rising,
  title,
}: {
  points: number[];
  rising?: boolean;
  title?: string;
}) {
  if (points.length < 2 || points.every((p) => p === points[0] && p === 0)) return null;
  const w = 100;
  const h = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const xy = points.map((p, i) => [i * step, h - 2 - ((p - min) / span) * (h - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = rising === false ? "hsl(var(--signal))" : "hsl(var(--acc-lime))";
  const last = xy[xy.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-2 h-6 w-full"
      role="img"
      aria-label={title ?? "Last eight weeks"}
    >
      <path d={area} fill={stroke} opacity="0.12" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
