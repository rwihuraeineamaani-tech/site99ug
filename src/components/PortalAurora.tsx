import { motion } from "framer-motion";

/**
 * Toned-down version of the home hero northern-lights aurora.
 * Lower opacity, slower motion, scoped to its container.
 */
export const PortalAurora = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen ${className}`}
  >
    <motion.div
      className="absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] rounded-full"
      style={{
        background:
          "radial-gradient(closest-side, hsl(var(--site-red) / 0.30), transparent 70%)",
        filter: "blur(90px)",
      }}
      animate={{ x: [0, 60, -30, 0], y: [0, 40, -20, 0], scale: [1, 1.1, 0.95, 1] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full"
      style={{
        background:
          "radial-gradient(closest-side, hsl(var(--site-red) / 0.22), transparent 70%)",
        filter: "blur(100px)",
      }}
      animate={{ x: [0, -80, 40, 0], y: [0, -30, 50, 0], scale: [1, 0.9, 1.15, 1] }}
      transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-0 left-1/3 w-[60vw] h-[60vw] rounded-full"
      style={{
        background:
          "radial-gradient(closest-side, hsl(var(--site-red) / 0.18), transparent 70%)",
        filter: "blur(110px)",
      }}
      animate={{ x: [0, 50, -60, 0], y: [0, -40, 20, 0], scale: [1, 1.08, 0.95, 1] }}
      transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

export default PortalAurora;
