import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/** Shown until this device has phone notifications turned on. */
export default function PushPromptBanner({ userId }: { userId?: string | null }) {
  const { status, busy, enable } = usePushNotifications(userId);
  if (status !== "disabled" && status !== "denied") return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-signal/40 bg-signal/10 p-3">
      <BellRing className="h-5 w-5 text-signal" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">Turn on notifications for this device</div>
        <p className="text-xs text-ink-soft">
          {status === "denied"
            ? "Notifications are blocked in your browser settings. Allow them for this site, then reload."
            : "Get your 6am brief, clock-in reminders, posting alerts, shoot calls and approvals on your phone."}
        </p>
      </div>
      {status === "disabled" && <Button size="sm" disabled={busy} onClick={enable}>Turn on</Button>}
    </div>
  );
}
