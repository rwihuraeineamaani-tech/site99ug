# Posting windows per platform

Replace the free "posted from / posted to" clock fields with a fixed set of named traffic windows, chosen for each platform alongside its post link.

## The windows

- Early morning traffic — 5:00–8:00
- Lunch traffic — 12:00–14:00
- Work traffic — 14:00–16:00
- Commuter traffic — 17:00–19:00
- Evening traffic — 19:00–22:00
- Late night traffic — 22:00–01:00

## What the handler sees

On the "Post it" step, each platform the founder picked gets one row:

```text
TikTok      [ link ................. ]  [ Early morning ] [ Lunch ] [ Work ] [ Commuter ] [ Evening ] [ Late night ]
Instagram   [ link ................. ]  [ Early morning ] [ Lunch ] [ Work ] [ Commuter ] [ Evening ] [ Late night ]
```

- One date field for the day it went out (replaces the two date-and-time fields).
- Window chips are single-select per platform; more than one can be picked if it was posted twice.
- "Posted" stays disabled until every platform with a link also has a window.

Afterwards the card and the archive show, per platform: platform, window name, and the link.

## Technical notes

- Window presets live in `src/lib/contentFlow.ts` as `POST_WINDOWS` (key, label, time range) so reports can group by them later.
- Store per-platform data in a new `content_items.posted_slots` jsonb column: `{ "TikTok": { "url": "...", "window": "commuter" } }`. `posted_links` keeps receiving the flat `"Platform: url"` strings so nothing already recorded breaks.
- `posted_from` / `posted_to` are set from the chosen date plus the earliest and latest window boundaries, so existing timestamps and metrics timing keep working.
- Changes: one migration for `posted_slots`, plus the Handover step, the posted summary block and the archive view in `src/pages/app/Content.tsx`.
