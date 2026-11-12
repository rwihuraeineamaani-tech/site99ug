# Five new client portal features

## 1. Monthly results report
- New **Reports** page in the client portal, one card per month.
- Staff (Handler, Comms, leadership) upload the report document (PDF or doc) for each month from the client's record, with a short summary, then publish it.
- Each month also shows the system's own numbers with graphs: videos posted, followers, reach, impressions, profile visits and link clicks (from the weekly account numbers), shoot days done, and on-time posting, compared with the month before.
- Clients can download the uploaded file and a system PDF with the same numbers and charts.
- Drafts stay hidden until published.

## 2. Brand files space
- New **Brand files** page where clients upload logos, product photos, price lists and other files, sorted into those categories.
- Staff see the same files on the client's record and can add or remove them. Clients can delete only the files they uploaded.
- The client's Handler gets a notification when something new is uploaded.

## 3. Client video ideas
- A **Suggest an idea** form in the portal: title, description, an optional reference link and a preferred month.
- Each idea lands in the content pipeline at the Idea stage, marked "From client", and the Handler is notified.
- Clients can follow each idea's progress (accepted, in production, posted, or declined with a reason).

## 4. Shoot ratings
- When a shoot day is finished, the client sees **Rate this shoot**: 1 to 5 stars for the overall shoot, the crew and timekeeping, plus a comment.
- One rating per shoot. It shows on the staff shoot-day screen and the client's record, and the average goes into Client Relations.

## 5. Approval alerts
- Clients get a push notification on phone or desktop when a video needs their approval, an invoice is sent, a report is published or a shoot is confirmed. The portal will ask them to turn alerts on.
- Email alerts go out for the same events.
- **Needs your action:** emails can't send until your sending address (notify.site99ug.com) is verified. Its check expired after 14 days. Push alerts will work right away. Emails start once the domain records are fixed, which I'll guide you through.

## Technical details
- New tables: `client_reports` (resident, month, file path, summary, published), `client_files` (resident, category, label, file path, uploaded_by), `shoot_ratings` (shoot_day, resident, scores, comment, unique per shoot). Each gets grants, RLS (staff manage, clients read/write only their own resident through `resident_users`), and private storage buckets `client-reports` and `client-files` with path-scoped policies.
- `client_suggest_idea` RPC inserts into `content_items` (stage idea, `source = 'client'`) using the client's resident, then notifies the handler.
- `client_month_metrics(resident, month)` RPC sums `account_metrics`, `content_items` and `shoot_days` so charts and PDFs read one source.
- Alerts go through the existing push outbox. A new client-alert email template uses the existing app email setup once the domain is verified.
- New portal routes: `/portal/reports`, `/portal/files`, `/portal/ideas`. Shoot rating appears on `/portal/shoots/:id`.
