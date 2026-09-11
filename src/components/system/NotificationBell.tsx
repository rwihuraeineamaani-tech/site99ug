import { Bell, BellRing, CalendarClock, Check, CheckCircle2, Megaphone, MessageSquare, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendarReminders } from "@/hooks/useCalendarReminders";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useCommunicationUnread } from "@/hooks/useCommunicationUnread";
import { useApprovalsWaiting } from "@/hooks/useApprovalsWaiting";
import { useMyRoles } from "@/hooks/useMyRoles";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const pushCopy: Record<string, string> = {
  disabled: "Turn on alerts for this device",
  denied: "Alerts are blocked in your browser settings",
  unsupported: "This browser cannot show alerts",
  "open-in-new-tab": "Open the app in its own tab to turn on alerts",
  "not-configured": "Alerts are not set up yet",
};

export default function NotificationBell() {
  const { userId } = useMyRoles();
  const { reminders, dismiss } = useCalendarReminders();
  const chat = useChatUnread();
  const { briefs, announcements } = useCommunicationUnread();
  const approvals = useApprovalsWaiting();
  const { status, busy, enable } = usePushNotifications(userId);

  const total = reminders.length + chat + briefs + announcements + approvals;

  const rows = [
    { key: "chat", count: chat, label: "New messages", to: "/app/chat", icon: MessageSquare },
    { key: "briefs", count: briefs, label: "Briefs to read", to: "/app/briefs", icon: FileText },
    { key: "announcements", count: announcements, label: "Announcements", to: "/app/announcements", icon: Megaphone },
    { key: "approvals", count: approvals, label: "Waiting for your approval", to: "/app/approvals", icon: CheckCircle2 },
  ].filter((row) => row.count > 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${total ? `, ${total} new` : ""}`}>
          {total > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[9px] font-bold text-paper">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="rule-b px-4 py-3">
          <div className="eyebrow text-[10px] text-signal">Notifications</div>
          <div className="mt-1 text-sm font-semibold">{total > 0 ? `${total} need${total === 1 ? "s" : ""} you` : "You are all caught up"}</div>
        </div>

        <div className="max-h-80 divide-y divide-rule overflow-y-auto">
          {rows.map(({ key, count, label, to, icon: Icon }) => (
            <Link key={key} to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-sunken">
              <Icon className="h-4 w-4 shrink-0 text-signal" />
              <span className="flex-1 truncate text-sm">{label}</span>
              <span className="rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-bold text-paper">{count}</span>
            </Link>
          ))}

          {reminders.map(({ item, occurrence }) => (
            <div key={`${item.id}-${occurrence}`} className="flex gap-3 px-4 py-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              <div className="min-w-0 flex-1">
                <Link to="/app/calendar" className="block truncate text-sm font-medium hover:text-signal">{item.title}</Link>
                <p className="text-[11px] text-ink-soft">{occurrence} · {item.all_day ? "All day" : item.start_time?.slice(0, 5)}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => dismiss(item.id, occurrence)} aria-label={`Dismiss ${item.title}`}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {total === 0 && <p className="px-4 py-6 text-sm text-ink-soft">Nothing needs your attention right now.</p>}
        </div>

        <div className="rule-t px-4 py-3">
          {status === "enabled" ? (
            <p className="text-[11px] text-ink-soft">Alerts are on for this device. Manage them in <Link to="/app/settings?tab=notifications" className="underline hover:text-signal">My settings</Link>.</p>
          ) : status === "disabled" ? (
            <Button size="sm" className="w-full" disabled={busy} onClick={enable}>{busy ? "Turning on…" : "Turn on alerts"}</Button>
          ) : status === "checking" ? null : (
            <p className="text-[11px] text-ink-soft">{pushCopy[status] ?? "Alerts are unavailable here."}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
