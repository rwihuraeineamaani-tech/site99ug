# Photos vs videos: separate numbers, separate monthly targets, visible to clients

## What changes for people

**1. Numbers depend on the type of post**
- Videos (Vertical short-form, Long-form) keep: Views, Reach, Avg. watch time, Likes, Comments, Shares, Reposts, Saves, Follows gained, Link clicks.
- Photo posts (Photo set, Poster, Carousel) get photo numbers: Impressions, Reach, Likes, Comments, Shares, Reposts, Saves, Profile visits, Follows gained, Link clicks. There's no watch time or views box.
- The pipeline's number boxes, the per-video cards in the client's Reports and the AI tips all follow the post's type.

**2. Monthly targets split into Videos and Photo posts**
- In Strategy goals and targets, you can set "Videos posted" and "Photo posts posted" for each client each month. These sit alongside the current "Posted content" and "Followers" targets, and the same Founder approval applies.
- Progress counts posted items of each type in the month. Cancelled posts don't count.

**3. Clients see their targets**
- On the client's Overview, a new "This month's targets" panel shows each target as a progress bar, for example "Videos 7 of 12" and "Photo posts 2 of 6".
- On Reports, each month opens with that month's targets and how they were met. The numbers for each post are grouped under Videos and Photo posts, each with its own totals.
- The Numbers PDF includes the targets and the photo/video split.
- Clients only see approved targets.

**4. Staff views use the same split**
- On the client record (Client view, Reports) and in the pipeline filters, Videos and Photo posts get their own counts. The dashboard targets cards show each type's progress.

## Assumptions
- "Video" means Vertical short-form and Long-form. "Photo post" means Photo set, Poster and Carousel. New types can be assigned to either group in one place.
- Old numbers saved on photo posts are kept, and any box that doesn't apply to photos stays readable as a note.

## Technical details
- `src/lib/contentFlow.ts`: add `contentKind(type) => "video" | "photo"`, and split `METRIC_FIELDS` into `VIDEO_METRICS` and `PHOTO_METRICS`, with `metricFieldsFor(type)`. `contentMetrics.ts` totals use the kind's fields (summed keys add `impressions`, `profile_visits` and `reposts`).
- `src/lib/strategy.ts` METRICS: add `posted_videos` and `posted_photos`. Actuals query `content_type`, `cancelled_at` and count by kind. `client_targets.metric` is text, so no schema change.
- DB: extend `client_month_metrics` to return `posted_videos`, `posted_photos` and `targets` (approved `client_targets` for the month: metric, target, actual). It stays security definer with the existing staff or own-resident check.
- Portal: new `ClientTargets` component used in PortalOverview and ClientReports. `VideoNumbers` is renamed to show Videos and Photo posts groups with kind-specific fields. Update `downloadMonthPdf`.
- Tests: `contentKind` mapping, plus a test that the per-kind target actuals ignore cancelled posts.
