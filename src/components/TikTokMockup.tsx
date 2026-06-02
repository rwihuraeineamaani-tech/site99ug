import { motion, useInView, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, Music2 } from "lucide-react";
import logoCircle from "@/assets/site-logo-circle.png.asset.json";

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return Math.round(n).toLocaleString();
};

/** Number that ticks up forever once in view, simulating live growth. */
function LiveNumber({ base, ratePerSec, jitter = 0.4 }: { base: number; ratePerSec: number; jitter?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "-40px" });
  const [val, setVal] = useState(base);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      // jittered rate so it feels organic
      const r = ratePerSec * (1 + (Math.random() - 0.5) * jitter);
      setVal((v) => v + r * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, ratePerSec, jitter]);
  return <span ref={ref}>{fmt(val)}</span>;
}

/** One-shot count-up on view, used for the views chip. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 2.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setVal(v) });
    return c.stop;
  }, [inView, to, mv]);
  return <span ref={ref}>{fmt(val)}</span>;
}

export const TikTokMockup = ({ src, alt }: { src: string; alt: string }) => {
  const [liked, setLiked] = useState(false);
  const [likeBoost, setLikeBoost] = useState(0); // extra likes from this user
  const [saved, setSaved] = useState(false);
  const [saveBoost, setSaveBoost] = useState(0);
  const [shareBoost, setShareBoost] = useState(0);
  const [commentBoost, setCommentBoost] = useState(0);
  const [musicMuted, setMusicMuted] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);

  const onTapVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    // double-tap to like
    const now = Date.now();
    const last = (onTapVideo as any)._last || 0;
    (onTapVideo as any)._last = now;
    if (now - last < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      addHeart(e.clientX - rect.left, e.clientY - rect.top);
      if (!liked) toggleLike();
    }
  };

  const addHeart = (x: number, y: number) => {
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), 900);
  };

  const toggleLike = () => {
    setLiked((prev) => {
      const next = !prev;
      setLikeBoost((n) => n + (next ? 1 : -1));
      return next;
    });
  };

  const onLikeBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
    toggleLike();
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = (e.currentTarget.closest("[data-mockup]") as HTMLElement | null)?.getBoundingClientRect();
    if (parent) addHeart(rect.left - parent.left + rect.width / 2, rect.top - parent.top);
  };

  return (
    <div
      data-mockup
      className="relative mx-auto w-full max-w-[340px] aspect-[9/16] rounded-[2rem] overflow-hidden bg-black ring-1 ring-white/10 shadow-[0_60px_120px_-30px_hsl(0_0%_0%/0.8),0_20px_50px_-15px_hsl(var(--site-red)/0.4)] select-none"
    >
      {/* Video frame — subtle continuous Ken Burns */}
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        animate={{ scale: [1, 1.08, 1], x: [0, -6, 0], y: [0, 4, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Tap target for the video area */}
      <div className="absolute inset-0 cursor-pointer" onClick={onTapVideo} />

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />

      {/* Floating heart bursts on tap */}
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 0.4, x: b.x - 40, y: b.y - 40, rotate: -10 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.4, 1.2, 1], y: b.y - 140 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute top-0 left-0 pointer-events-none"
          >
            <Heart className="w-20 h-20 text-site-red" fill="currentColor" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 px-4 pt-3 flex justify-between items-center text-white text-[11px] mono pointer-events-none">
        <span className="opacity-80">9:41</span>
        <span className="w-3 h-1.5 rounded-sm border border-white/70" />
      </div>

      {/* For You / Following */}
      <div className="absolute top-10 inset-x-0 flex justify-center gap-6 text-white text-[13px] font-medium pointer-events-none">
        <span className="opacity-60">Following</span>
        <span className="relative">
          For You
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-white rounded-full" />
        </span>
      </div>

      {/* Live views chip — counts up once, then ticks live */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="absolute top-20 left-3 flex items-center gap-2 bg-site-red text-white px-2.5 py-1 rounded-full text-[11px] mono uppercase tracking-wider pointer-events-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <CountUp to={2_400_000} /> views
      </motion.div>

      {/* Right side action rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white z-10">
        <div className="w-10 h-10 rounded-full ring-2 ring-white bg-white overflow-hidden">
          <img src={logoCircle.url} alt="Site 99" className="w-full h-full object-cover" />
        </div>

        {/* LIKE — interactive */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            type="button"
            onClick={onLikeBtn}
            whileTap={{ scale: 0.78 }}
            animate={liked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className="outline-none"
          >
            <Heart
              className={`w-8 h-8 transition-colors ${liked ? "text-site-red" : "text-white"}`}
              fill={liked ? "currentColor" : "white"}
            />
          </motion.button>
          <span className="text-[11px] mono">
            <LiveNumber base={842_300 + likeBoost} ratePerSec={2.3} />
          </span>
        </div>

        <ActionStat icon={<MessageCircle className="w-7 h-7" fill="white" />} base={12_400} rate={0.4} />
        <ActionStat icon={<Bookmark className="w-7 h-7" fill="white" />} base={56_700} rate={0.6} />
        <ActionStat icon={<Share2 className="w-7 h-7" />} base={9_100} rate={0.2} />

        {/* Spinning vinyl */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="w-9 h-9 rounded-full border-2 border-white/30 bg-gradient-to-br from-zinc-700 to-black flex items-center justify-center"
        >
          <Music2 className="w-3 h-3 text-white" />
        </motion.div>
      </div>

      {/* Bottom caption */}
      <div className="absolute left-0 right-16 bottom-14 px-4 text-white pointer-events-none">
        <div className="text-[13px] font-semibold mb-1">@site99.ug</div>
        <div className="text-[12px] leading-snug opacity-95">
          How one clip saves <span className="text-site-red font-semibold">10M UGX</span> in TV ad spend ↓ <span className="font-semibold">#site99</span> #brandsthat travel
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90 overflow-hidden whitespace-nowrap">
          <Music2 className="w-3 h-3 shrink-0" />
          <motion.span
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            original sound — site99.ug · original sound — site99.ug ·&nbsp;
          </motion.span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-12 inset-x-0 h-[2px] bg-white/15">
        <motion.div
          className="h-full bg-white"
          animate={{ width: ["0%", "100%"] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-black/80 backdrop-blur flex justify-around items-center text-white text-[10px] pointer-events-none">
        <span className="font-semibold">Home</span>
        <span className="opacity-60">Shop</span>
        <span className="w-9 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold">+</span>
        <span className="opacity-60">Inbox</span>
        <span className="opacity-60">Profile</span>
      </div>
    </div>
  );
};

function ActionStat({ icon, base, rate }: { icon: React.ReactNode; base: number; rate: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[11px] mono"><LiveNumber base={base} ratePerSec={rate} /></span>
    </div>
  );
}
