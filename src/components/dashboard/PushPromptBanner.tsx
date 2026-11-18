import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const HIDE_DAYS = 7;
const hideKey = (userId?: string | null) => `site99:push-banner-hidden:${userId ?? "anon"}`;

const COPY = {
  staff: "Get your 6am brief, clock-in reminders, posting alerts, shoot calls and approvals on your phone.",
  client: "Get an alert when a video is ready for your review, a shoot day is set, or a new report or invoice arrives.",
};

/** Shown until this device has phone notifications turned on. It can be hidden for a week. */
export default function PushPromptBanner({
  userId,
  audience = "staff",
}: {
  userId?: string | null;
  audience?: "staff" | "client";
}) {
  const { status, busy, enable } = usePushNotifications(userId);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const at = Number(localStorage.getItem(hideKey(userId)) ?? 0);
    setHidden(at > 0 && Date.now() - at < HIDE_DAYS * 86_400_000);
  }, [userId]);
  if (hidden || (status !== "disabled" && status !== "denied")) return null;

  const hide = () => {
    localStorage.setItem(hideKey(userId), String(Date.now()));
    setHidden(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-signal/40 bg-signal/10 p-3 sm:items-center">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-signal sm:mt-0" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">Turn on notifications for this device</div>
        <p className="text-xs text-ink-soft">
          {status === "denied"
            ? "Notifications are blocked in your browser settings. Allow them for this site, then reload."
            : COPY[audience]}
        </p>
        {status === "disabled" && (
          <Button size="sm" className="mt-2 sm:hidden" disabled={busy} onClick={enable}>
            {busy ? "Turning on…" : "Turn on"}
          </Button>
        )}
      </div>
      {status === "disabled" && (
        <Button size="sm" className="hidden shrink-0 sm:inline-flex" disabled={busy} onClick={enable}>
          {busy ? "Turning on…" : "Turn on"}
        </Button>
      )}
      <button
        type="button"
        onClick={hide}
        aria-label="Hide for now"
        title="Hide for now"
        className="press focus-ring -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ink-soft hover:bg-paper-raised hover:text-ink sm:mt-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
