import { motion, useMotionValue, useSpring, useTransform, MotionValue } from "framer-motion";
import { ReactNode, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  children: ReactNode;
  className?: string;
  max?: number; // max tilt deg
  scale?: number;
  glare?: boolean;
};

/** Lightweight 3D tilt-on-hover wrapper. Disabled on mobile. */
export const Tilt3D = ({ children, className, max = 10, scale = 1.02, glare = true }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // All hooks must run unconditionally — never gate them behind isMobile or props.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 180, damping: 20, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 180, damping: 20, mass: 0.4 });

  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const glareBg = useTransform<number, string>(
    [sx, sy] as unknown as MotionValue<number>[],
    (vals) => {
      const [x, y] = vals as unknown as [number, number];
      return `radial-gradient(circle at ${x * 100}% ${y * 100}%, hsl(0 0% 100% / 0.35), transparent 55%)`;
    },
  );

  if (isMobile) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ perspective: 1200 }} className={className}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", willChange: "transform" }}
        whileHover={{ scale }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="relative w-full h-full"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </div>
  );
};
