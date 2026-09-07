import { useEffect, useState } from "react";

/** Kampala time to the second, for the top right of the shell. */
export function useKampalaTick() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Kampala",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Kampala",
  }).format(now);
  return { time, date };
}

export default function HeaderClock() {
  const { time, date } = useKampalaTick();
  const [hms, sec] = [time.slice(0, 5), time.slice(6, 8)];
  return (
    <div className="hidden sm:flex flex-col items-end leading-none">
      <div className="flex items-baseline gap-1">
        <span className="pulse-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-signal" />
        <span className="num text-lg font-semibold tracking-tight tabular-nums">{hms}</span>
        <span className="num text-[11px] text-signal tabular-nums">:{sec}</span>
      </div>
      <div className="mt-1 eyebrow text-[9px] text-ink-faint">{date} · Kampala</div>
    </div>
  );
}
