import { AnimatePresence, motion } from "framer-motion";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

type WipeFn = (to: string, origin?: { x: number; y: number }) => void;

const Ctx = createContext<WipeFn>(() => {});

export const useThemeWipe = () => useContext(Ctx);

const EASE = [0.76, 0, 0.24, 1] as const;

export const ThemeWipeProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "cover" | "reveal">("idle");

  const start = useCallback<WipeFn>(
    (to) => {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        navigate(to);
        return;
      }
      setPhase("cover");
      window.setTimeout(() => {
        navigate(to);
        window.scrollTo({ top: 0 });
        setPhase("reveal");
      }, 430);
      window.setTimeout(() => setPhase("idle"), 1000);
    },
    [navigate],
  );

  const covering = phase === "cover";

  return (
    <Ctx.Provider value={start}>
      <motion.div
        animate={{ scale: covering ? 0.965 : 1, opacity: covering ? 0.35 : 1 }}
        transition={{ duration: 0.43, ease: EASE }}
        style={{ transformOrigin: "50% 45%" }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            key="morph"
            aria-hidden
            className="fixed inset-0 z-[500] pointer-events-none bg-black"
            initial={{ y: "100%" }}
            animate={{ y: phase === "cover" ? "0%" : "-100%" }}
            transition={{ duration: phase === "cover" ? 0.45 : 0.55, ease: EASE }}
          >
            <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(hsl(0_0%_100%/0.8)_1px,transparent_1px)] [background-size:26px_26px]" />
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
        wipe(to);
      }}
    >
      {children}
    </a>
  );
};
