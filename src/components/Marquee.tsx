import { useEffect, useRef } from "react";

interface Props {
  items: { name: string; logo: string }[];
  className?: string;
}

/** Seconds for one full loop of the logo list. Lower is faster. */
const LOOP_SECONDS = 70;
/** How long the strip waits after someone swipes or drags before it starts moving again. */
const RESUME_AFTER_MS = 1500;

/**
 * Scrolling wall of client logos. Logos are expected on white backgrounds.
 * Moves on its own, and visitors can swipe (phones), drag or wheel (desktop) through it.
 */
export const Marquee = ({ items, className = "" }: Props) => {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const drag = useRef<{ x: number; start: number } | null>(null);

  // Repeat short lists so one half always fills a wide screen, then double for the seamless loop.
  const reps = Math.max(1, Math.ceil(8 / Math.max(items.length, 1)));
  const half = Array.from({ length: reps }, () => items).flat();
  const doubled = [...half, ...half];

  useEffect(() => {
    const el = scroller.current;
    const tr = track.current;
    if (!el || !tr || !items.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const halfWidth = () => tr.scrollWidth / 2;

    const wrap = () => {
      const w = halfWidth();
      if (w <= 0) return;
      if (el.scrollLeft >= w) el.scrollLeft -= w;
      else if (el.scrollLeft <= 0 && pausedUntil.current > performance.now()) el.scrollLeft += w;
      pos.current = el.scrollLeft;
    };

    let raf = 0;
    let last = performance.now();
    let ownScroll = false;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const idle = !hovering.current && !drag.current && now > pausedUntil.current;
      if (idle && !reduce) {
        const w = halfWidth();
        if (w > 0) {
          pos.current += (w / LOOP_SECONDS) * (dt / 1000);
          if (pos.current >= w) pos.current -= w;
          ownScroll = true;
          el.scrollLeft = pos.current;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      if (ownScroll) {
        ownScroll = false;
        return;
      }
      wrap();
    };
    const pause = () => {
      pausedUntil.current = performance.now() + RESUME_AFTER_MS;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchmove", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchmove", pause);
      el.removeEventListener("wheel", pause);
    };
  }, [items.length]);

  if (!items.length) return null;

  // Mouse drag on desktop. Touch uses the browser's own swipe scrolling.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !scroller.current) return;
    drag.current = { x: e.clientX, start: scroller.current.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !scroller.current) return;
    scroller.current.scrollLeft = drag.current.start - (e.clientX - drag.current.x);
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    pausedUntil.current = performance.now() + RESUME_AFTER_MS;
  };

  return (
    <div
      ref={scroller}
      className={`logo-strip no-scrollbar overflow-x-auto overscroll-x-contain py-5 md:py-8 cursor-grab active:cursor-grabbing touch-pan-x ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => {
        hovering.current = false;
        endDrag();
      }}
      aria-label="Brands that trust Site 99"
    >
      <div ref={track} className="flex items-center gap-12 md:gap-20 w-max">
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
