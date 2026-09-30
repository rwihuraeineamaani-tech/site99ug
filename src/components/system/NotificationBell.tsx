import { Bell, BellRing, CalendarClock, Check, CheckCheck, CheckCircle2, Megaphone, MessageSquare, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendarReminders } from "@/hooks/useCalendarReminders";
import { useMyRoles } from "@/hooks/useMyRoles";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationFeed } from "@/hooks/useNotificationFeed";
import { useAppBadge } from "@/hooks/useAppBadge";

const pushCopy: Record<string, string> = {
  disabled: "Turn on alerts for this device",
  denied: "Alerts are blocked in your browser settings",
  unsupported: "This browser cannot show alerts",
  "open-in-new-tab": "Open the app in its own tab to turn on alerts",
  "not-configured": "Alerts are not set up yet",
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div>
      <div className="bg-paper-sunken px-4 py-1.5 eyebrow text-[9px] text-ink-faint">{title} · {count}</div>
      <div className="divide-y divide-rule">{children}</div>
    </div>
  );
}

export default function NotificationBell() {
  const { userId, isClient, isStaff } = useMyRoles();
  const { reminders, dismiss } = useCalendarReminders();
  const { chats, reads, approvals, total: feedTotal, markAllRead } = useNotificationFeed();
  const { status, busy, enable } = usePushNotifications(userId);

  const total = feedTotal + reminders.length;
  const appBase = isClient && !isStaff ? "/portal" : "/app";
  useAppBadge(total);

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
      <PopoverContent align="end" sideOffset={10} className="w-[calc(100vw-1rem)] max-w-96 p-0">
        <div className="rule-b flex items-center justify-between px-4 py-3">
          <div>
            <div className="eyebrow text-[10px] text-signal">Notifications</div>
            <div className="mt-1 text-sm font-semibold">{total > 0 ? `${total} need${total === 1 ? "s" : ""} you` : "You are all caught up"}</div>
          </div>
          {reads.length > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-ink-faint underline underline-offset-4 hover:text-signal">
              <CheckCheck className="h-3.5 w-3.5" /> mark all read
            </button>
          )}
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          <Section title="Messages" count={chats.length}>
            {chats.map((c) => (
              <Link key={c.id} to={`${appBase}/chat`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-paper-sunken">
                <MessageSquare className="h-4 w-4 shrink-0 text-signal" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-ink-faint">{timeAgo(c.at)}</span>
                  </div>
                  <p className="truncate text-[11px] text-ink-soft">{c.preview}</p>
                </div>
                <span className="rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-bold text-paper">{c.unread}</span>
              </Link>
            ))}
          </Section>

          <Section title="Waiting for your approval" count={approvals.length}>
            {approvals.map((a) => (
              <Link key={a.key} to={a.to} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-paper-sunken">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-signal" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <p className="truncate text-[11px] text-ink-soft">{a.sub}</p>
                </div>
              </Link>
            ))}
          </Section>

          <Section title="To read" count={reads.length}>
            {reads.map((r) => (
              <Link key={`${r.kind}-${r.id}`} to={r.kind === "brief" ? "/app/briefs" : "/app/announcements"} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-paper-sunken">
                {r.kind === "brief" ? <FileText className="h-4 w-4 shrink-0 text-signal" /> : <Megaphone className="h-4 w-4 shrink-0 text-signal" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <p className="text-[11px] text-ink-soft">{r.kind === "brief" ? "Brief" : "Announcement"}</p>
                </div>
              </Link>
            ))}
          </Section>

          <Section title="Calendar" count={reminders.length}>
            {reminders.map(({ item, occurrence }) => (
              <div key={`${item.id}-${occurrence}`} className="flex gap-3 px-4 py-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                <div className="min-w-0 flex-1">
                  <Link to={isStaff ? "/app/calendar" : `${appBase}/calendar`} className="block truncate text-sm font-medium hover:text-signal">{item.title}</Link>
                  <p className="text-[11px] text-ink-soft">{occurrence} · {item.all_day ? "All day" : item.start_time?.slice(0, 5)}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => dismiss(item.id, occurrence)} aria-label={`Dismiss ${item.title}`}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Section>

          {total === 0 && <p className="px-4 py-6 text-sm text-ink-soft">Nothing needs your attention right now.</p>}
        </div>

        <div className="rule-t px-4 py-3">
          {status === "enabled" ? (
            <p className="text-[11px] text-ink-soft">Alerts are on for this device.{isStaff && <> Manage them in <Link to="/app/settings?tab=notifications" className="underline hover:text-signal">My settings</Link>.</>}</p>
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
