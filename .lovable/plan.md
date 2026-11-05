# Posting windows cleanup + more notifications (including clock-in)

## What we found
- The push sender is running every minute and has delivered recent alerts (payments, tasks, chat, renewals).
- The 6am morning brief sent nothing: it only goes to a Handler who has a post, shoot, overdue post or metrics due that same day. No one qualified, so it stayed silent.
- The 30-minute posting reminders are queued correctly; the next one is due Fri 6 Nov. None were due yet.
- Only 8 of 25 staff have turned on phone notifications on any device, so most people cannot receive pushes at all.

## 1. Posting windows (approved earlier)
- Remove the "Window opens / Window closes" date pickers from the post extras editor.
- Handlers pick from the existing traffic windows (Early morning, Lunch, Work, Commuter, Evening, Late night); default follows the planned posting time.
- Client calendar and review card show the named window, for example "Thu 6 Nov, Lunch (12:00 to 14:00)".

## 2. Morning brief for everyone, every working day
- 6am Kampala brief goes to every staff member, not just Handlers with posts.
- Each brief is personal: today's tasks and deadlines, posts and shoots, waiting approvals, overdue items, calendar events, and a clock-in reminder.
- If someone has nothing scheduled, they still get a short useful brief (week ahead, oldest open task) instead of silence.

## 3. Clock-in notifications
- Reminder 15 minutes before the clock-in deadline set by the MD, on working days, for anyone not yet clocked in.
- "You're late" nudge at the deadline for anyone still not clocked in.
- Evening reminder to clock out if still clocked in.
- MD gets a short daily summary after the deadline: who is in, late, or absent.

## 4. More everyday alerts
- Task due tomorrow and task overdue reminders to the person it is assigned to.
- Calendar event reminder 30 minutes before.
- Shoot day reminder the evening before to all crew and the contact person.
- Approval waiting more than 24 hours: reminder to the approver.
- Client approved or rejected a post, caption, collab or tag: alert to the Handler.
- Invoice overdue: alert to Finance and the client Handler.

## 5. Getting everyone connected
- A clear "Turn on notifications" banner on the dashboard for staff with no active device, until they enable it.
- System Admin People view shows who has notifications on.
- Every push also lands in the notification bell, so nobody misses it even without phone alerts.

## Technical details
- Rewrite `run_handler_morning_brief` into a general `run_staff_morning_brief` (same 03:00 UTC cron), per-user aggregation from tasks, calendar, approvals, content, shoots, attendance.
- New `run_attendance_reminders()` cron every 5 minutes, reading `attendance_settings` deadline and working days in Africa/Kampala; idempotent `event_key` per user per day per type.
- New `run_due_reminders()` cron every 15 minutes for tasks, calendar, shoots, stale approvals, overdue invoices; triggers on client review changes.
- All write to `push_outbox` plus `inbox_messages`/bell, respecting `push_preferences` categories.
- `PostExtrasEditor` uses `POST_WINDOWS` chips; store key in the content item, derive start/end for display; drop use of `post_window_start/end` inputs.
