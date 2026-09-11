import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { areaFromPath, logActivity, pageLabel, touchPresence, type ActorKind } from "@/lib/activity";

const HEARTBEAT_MS = 60_000;

/**
 * Keeps presence fresh and records one line per page the person opens.
 * Mounted once per shell (team side and client portal).
 */
export function useActivityTracker(kind: ActorKind = "staff") {
  const { pathname } = useLocation();
  const lastLogged = useRef<string>("");

  useEffect(() => {
    let stopped = false;
    const beat = () => {
      if (stopped || document.visibilityState === "hidden") return;
      void touchPresence(pathname, navigator.userAgent);
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [pathname]);

  useEffect(() => {
    if (lastLogged.current === pathname) return;
    lastLogged.current = pathname;
    const handle = window.setTimeout(() => {
      void logActivity({
        action: "page_view",
        area: areaFromPath(pathname),
        summary: `Opened ${pageLabel(pathname)}`,
        path: pathname,
        actorKind: kind,
      });
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [pathname, kind]);
}

export default useActivityTracker;
