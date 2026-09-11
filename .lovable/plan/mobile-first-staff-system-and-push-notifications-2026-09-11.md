# Mobile-first staff system and push notifications

## Goal
Make the entire authenticated staff system comfortable to use on a phone, then add opt-in push notifications for tasks, approvals, communication, and finance activity.

## 1. Mobile-first application shell
- Simplify the phone header to the menu, Site 99 identity, notification access, and profile; move secondary account actions into the mobile drawer.
- Preserve role-based navigation while improving touch targets, drawer scrolling, active states, safe-area spacing, and dark/light appearance.
- Add shared mobile patterns for page headings, action bars, tabs, filters, dialogs, forms, cards, and dense records so controls remain reachable and text never overlaps.

## 2. Whole-system mobile pass
- Audit every authenticated staff page at narrow-phone, standard-phone, tablet, and desktop widths.
- Convert important tables into readable mobile card rows, retaining tables on larger screens; hide only secondary columns and keep primary actions visible.
- Make Dashboard and To-Do summaries compact and swipeable where appropriate.
- Default Calendar to agenda on phones, retain month/week on larger screens, and make event editing touch-friendly.
- Adapt dense areas—including Sales, Residents, shoots, Strategy maps, Content, Approvals, Legal, Management, Finance, Team, and System Administration—with stacked controls, scroll-safe tabs, usable diagrams, and 44px minimum touch targets.
- Verify key workflows end to end on mobile: navigation, Resident onboarding, Sales handoff, task completion, approvals, chat/brief viewing, calendar editing, shoot-day work, invoice/payment review, and finance PIN unlock.

## 3. Push notification foundation
- Connect Firebase Cloud Messaging with web push enabled before implementation; no compatible connection is currently linked.
- Add secure per-user device-token storage, device labels, last-seen timestamps, revocation, and row-level access rules.
- Add notification preferences by category: Tasks & deadlines, Approvals, Messages & briefs, and Finance alerts. Each category can be enabled or disabled independently.
- Add a Notifications section in My Settings with an explicit “Enable notifications” action, permission/status guidance, connected-device management, and test delivery.
- Handle browser limitations clearly: permission is requested only after a tap, and the embedded preview asks the user to open the app in its own tab because browsers block permission prompts inside the preview frame.

## 4. Notification delivery
- Add a dedicated Firebase messaging worker for background notifications only; do not add offline caching or an app-shell service worker.
- Send notifications from authenticated backend functions through the Firebase connector, never from the browser.
- Create a durable notification outbox with a unique event key, recipient, category, title, concise body, deep link, delivery status, attempts, and timestamps to prevent duplicates and support retries.
- Resolve recipients server-side from assignments, workflow approvers, chat participants, brief audiences, finance authority, and role membership; never trust a browser-supplied recipient list for protected events.
- Remove invalid/stale device tokens when Firebase reports them and back off temporary provider failures.

## 5. Events covered
- **Tasks & deadlines:** new assignments, due-soon and overdue work, calendar reminders, shoot-day call times, and Sales follow-ups.
- **Approvals:** newly assigned approvals, reminders/escalations, changes requested, approvals, and rejections.
- **Messages & briefs:** direct messages, replies, newly issued briefs, and published announcements; do not notify the sender.
- **Finance:** cash requests, payment approvals, invoice due/overdue events, payment-run decisions, and high-value second approvals. Notification text must avoid exposing sensitive account details or PIN information.
- Every notification opens the exact relevant page or record after sign-in; inaccessible or deleted records fall back to the appropriate list.

## 6. Scheduling and reliability
- Use database-triggered outbox entries for immediate business events and a scheduled dispatcher for reminders, overdue items, and retries.
- Respect Kampala time for human-facing deadlines while storing timestamps consistently.
- Add delivery logging visible to system administrators without exposing message contents unnecessarily.
- Keep existing in-app badges and reminders as the source of truth; push is an additional alert channel, not a replacement.

## 7. Validation
- Test permission granted, denied, unsupported, preview-frame, signed-out, token refresh, multiple devices, duplicate suppression, stale-token removal, and preference opt-out cases.
- Verify foreground and background delivery, notification deep links, and recipient isolation for all four categories.
- Run focused tests, typecheck, automated build checks, backend linting, and browser checks at representative mobile and desktop sizes.

## Technical notes
- Existing in-app sources include `calendar_items`, `approval_tasks`, `chat_messages`, briefs/announcements with read state, Sales follow-ups, cash requests, payment-run lines, and the unified To-Do aggregation.
- Firebase client configuration comes from the linked connector’s public web variables; server credentials remain available only to backend functions through the connector gateway.
- The messaging worker lives separately from installability/offline behavior. This phase does not add offline mode.
