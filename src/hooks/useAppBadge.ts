import { useEffect } from "react";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Shows the number of things waiting for you on the installed app icon (home screen / dock). */
export function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge) return;
    const safe = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
    const run = safe > 0 ? nav.setAppBadge(safe) : nav.clearAppBadge?.() ?? nav.setAppBadge(0);
    run?.catch(() => undefined);
  }, [count]);
}

export default useAppBadge;
