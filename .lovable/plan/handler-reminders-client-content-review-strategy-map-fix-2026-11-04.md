# Handler reminders, client content review, strategy map fix

## 1. Posting reminders for Handlers (30 minutes before)
- 30 minutes before each scheduled post, the client's Handler gets a phone notification and a notification bell item.
- It carries everything needed to post: client, video title, platforms and account handles, the final cut link, the approved caption, tags, collaboration account, and the posting window.
- Tapping it opens a "Ready to post" page with copy buttons for caption and tags, the cut download link, and a "Mark posted" button.
- Each post is reminded once only, even if the time changes later (a changed time re-arms it).

## 2. Morning brief for Handlers
- Every day at 6am Kampala time, each Handler gets one brief: today's posts per client with windows, shoot days, captions still waiting on the client, metrics due, and overdue items.
- Arrives as a phone notification plus an inbox message, and shows as a card at the top of their dashboard.
- Handlers with nothing on get no brief.

## 3. Client calendar: full content review
For each planned video in the client's calendar, the client sees and acts on:
- **Final cut link** (not the reference link), opening the edited video.
- **Caption**, which they can edit and save. The Handler sees the client's version and when it changed.
- **Collaboration**: whether it is a collab post, the partner's handle with a link to their profile, and a Reject button.
- **Tags**: each tagged account listed with a profile link, and each can be rejected.
- **Posting window** (for example "Thu 12 Nov, 6pm to 8pm"), never the exact minute.
- **Approve post** or **Request changes** with a note. Rejections and edits notify the Handler, and the content team sees the client's decisions in the Content Pipeline.

Staff enter the caption, collab handle, tags and window in the content item, so the client always reviews what will actually go out.

## 4. Strategy map not working
- The cause is not confirmed yet. The page code and storage look correct on reading, so step one is reproducing it signed in (as you and as a regular staff member): opening a client, adding steps, saving, sending to Founders.
- Fix whatever breaks (likely a permission rule on saving or on version history), then confirm save, reload and Founder sign-off work end to end.
- If you can tell me what you see (blank screen, error message, won't save), that speeds this up.

## Technical details
- New columns on `content_items`: `client_caption`, `caption_edited_by_client_at`, `collab_handle`, `collab_url`, `collab_status`, `tags jsonb` (handle, url, status), `post_window_start`, `post_window_end`, `client_review_state`, `client_review_note`, `post_reminder_sent_at`.
- Client writes only through a SECURITY DEFINER RPC (`client_review_content`) scoped to their resident, so they cannot touch other fields.
- Reminders: one `pg_cron` job every 10 minutes enqueueing due items into the existing `push_outbox` (cost trade-off: 144 light checks a day; max 10 min drift, so fires 30 to 40 min before). Morning brief: daily cron at 03:00 UTC. Both reuse `send-push` and inbox.
- Portal calendar updated in `PortalCalendar.tsx`; staff fields added to the content item editor.
