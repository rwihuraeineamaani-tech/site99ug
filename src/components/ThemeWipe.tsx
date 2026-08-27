import { AnimatePresence, motion } from "framer-motion";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

type WipeFn = (to: string, origin?: { x: number; y: number }) => void;

const Ctx = createContext<WipeFn>(() => {});

export const useThemeWipe = () => useContext(Ctx);

export const ThemeWipeProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [wipe, setWipe] = useState<{ x: number; y: number } | null>(null);

  const start = useCallback<WipeFn>(
    (to, origin) => {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        navigate(to);
        return;
      }
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 2;
      setWipe({ x, y });
      window.setTimeout(() => navigate(to), 460);
      window.setTimeout(() => setWipe(null), 900);
    },
    [navigate],
  );

  return (
    <Ctx.Provider value={start}>
      {children}
      <AnimatePresence>
        {wipe && (
          <motion.div
            key="theme-wipe"
            aria-hidden
            className="fixed inset-0 z-[500] pointer-events-none"
            initial={{ clipPath: `circle(0px at ${wipe.x}px ${wipe.y}px)` }}
            animate={{ clipPath: `circle(${Math.hypot(window.innerWidth, window.innerHeight) * 1.1}px at ${wipe.x}px ${wipe.y}px)` }}
            exit={{ opacity: 0 }}
            transition={{ clipPath: { duration: 0.75, ease: [0.76, 0, 0.24, 1] }, opacity: { duration: 0.35 } }}
            style={{
              background:
                "radial-gradient(circle at var(--wx) var(--wy), hsl(var(--ai-accent) / 0.35), hsl(0 0% 2%) 45%, hsl(0 0% 0%) 100%)",
              // @ts-expect-error custom props
              "--wx": `${wipe.x}px`,
              "--wy": `${wipe.y}px`,
            }}
          >
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(hsl(var(--ai-accent)/0.6)_1px,transparent_1px)] [background-size:26px_26px] animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
};

export const WipeLink = ({
  to,
  className,
  children,
  onNavigate,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) => {
  const wipe = useThemeWipe();
  return (
    <a
      href={to}
      className={className}
      data-hover
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        wipe(to, { x: e.clientX, y: e.clientY });
      }}
    >
      {children}
    </a>
  );
};
