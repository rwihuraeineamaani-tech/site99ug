import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export const Cursor = () => {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { damping: 25, stiffness: 350, mass: 0.4 });
  const sy = useSpring(y, { damping: 25, stiffness: 350, mass: 0.4 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement;
      setHover(!!t.closest("a, button, [data-hover]"));
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[10000] mix-blend-difference"
        style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
      >
        <motion.div
          animate={{ width: hover ? 56 : 14, height: hover ? 56 : 14, backgroundColor: hover ? "hsl(var(--site-red))" : "hsl(0 0% 100%)" }}
          transition={{ type: "spring", damping: 20, stiffness: 250 }}
          className="rounded-full"
        />
      </motion.div>
    </>
  );
};
