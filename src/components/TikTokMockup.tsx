import { motion, useInView, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, Music2 } from "lucide-react";

function TickingNumber({ to, suffix = "", duration = 2.4 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(v),
    });
    return c.stop;
  }, [inView, to, mv, duration]);
  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return Math.round(n).toLocaleString();
  };
  return <span ref={ref}>{fmt(val)}{suffix}</span>;
}

export const TikTokMockup = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <div className="relative mx-auto w-full max-w-[340px] aspect-[9/16] rounded-[2rem] overflow-hidden bg-black ring-1 ring-white/10 shadow-[0_60px_120px_-30px_hsl(0_0%_0%/0.8),0_20px_50px_-15px_hsl(var(--site-red)/0.4)]">
      {/* Video frame */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 px-4 pt-3 flex justify-between items-center text-white text-[11px] mono">
        <span className="opacity-80">9:41</span>
        <span className="flex items-center gap-1 opacity-80">
          <span className="w-3 h-1.5 rounded-sm border border-white/70" />
        </span>
      </div>

      {/* For You / Following */}
      <div className="absolute top-10 inset-x-0 flex justify-center gap-6 text-white text-[13px] font-medium">
        <span className="opacity-60">Following</span>
        <span className="relative">
          For You
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-white rounded-full" />
        </span>
      </div>

      {/* Right side action rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white">
        <div className="w-10 h-10 rounded-full ring-2 ring-white bg-site-red flex items-center justify-center text-[10px] font-bold">99</div>
        <ActionStat icon={<Heart className="w-7 h-7 fill-white" />} value={842300} />
        <ActionStat icon={<MessageCircle className="w-7 h-7 fill-white" />} value={12400} />
        <ActionStat icon={<Bookmark className="w-7 h-7 fill-white" />} value={56700} />
        <ActionStat icon={<Share2 className="w-7 h-7" />} value={9100} />
      </div>

      {/* Bottom caption */}
      <div className="absolute left-0 right-16 bottom-14 px-4 text-white">
        <div className="text-[13px] font-semibold mb-1">@site99.ug</div>
        <div className="text-[12px] leading-snug opacity-95">
          How one clip saves <span className="text-site-red font-semibold">10M UGX</span> in TV ad spend ↓ <span className="font-semibold">#site99</span> #brandsthat travel
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90">
          <Music2 className="w-3 h-3" />
          <span className="truncate">original sound — site99.ug</span>
        </div>
      </div>

      {/* Live views counter chip — counting motion */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="absolute top-20 left-3 flex items-center gap-2 bg-site-red text-white px-2.5 py-1 rounded-full text-[11px] mono uppercase tracking-wider"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <TickingNumber to={2_400_000} /> views
      </motion.div>

      {/* Bottom nav */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-black/80 backdrop-blur flex justify-around items-center text-white text-[10px]">
        <span className="font-semibold">Home</span>
        <span className="opacity-60">Shop</span>
        <span className="w-9 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold">+</span>
        <span className="opacity-60">Inbox</span>
        <span className="opacity-60">Profile</span>
      </div>
    </div>
  );
};

function ActionStat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[11px] mono"><TickingNumber to={value} duration={2 + Math.random()} /></span>
    </div>
  );
}
