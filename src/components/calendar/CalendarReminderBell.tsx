import { Bell, CalendarClock, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendarReminders } from "@/hooks/useCalendarReminders";

export default function CalendarReminderBell() {
  const { reminders, dismiss } = useCalendarReminders();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Calendar reminders">
          <Bell className="h-4 w-4" />
          {reminders.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[9px] font-bold text-paper">{Math.min(9, reminders.length)}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="rule-b px-4 py-3"><div className="eyebrow text-[10px] text-signal">Reminders</div><div className="mt-1 text-sm font-semibold">Due now</div></div>
        <div className="max-h-80 divide-y divide-rule overflow-y-auto">
          {reminders.length === 0 && <p className="px-4 py-6 text-sm text-ink-soft">Nothing needs your attention.</p>}
          {reminders.map(({ item, occurrence }) => (
            <div key={`${item.id}-${occurrence}`} className="flex gap-3 px-4 py-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              <div className="min-w-0 flex-1"><Link to="/app/calendar" className="block truncate text-sm font-medium hover:text-signal">{item.title}</Link><p className="text-[11px] text-ink-soft">{occurrence} · {item.all_day ? "All day" : item.start_time?.slice(0, 5)}</p></div>
              <Button variant="ghost" size="icon-sm" onClick={() => dismiss(item.id, occurrence)} aria-label={`Dismiss ${item.title}`}><Check className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
