# Fix homepage top photo and make the logo strip logos only

## What's wrong
- **Top photo:** the background picture loads, but the file itself is almost completely black (average brightness 7 out of 255). Under the red glow, the section looks like it has no photo.
- **Logo strip:** clients without a logo show up as big text names. If no client data comes through, the strip falls back to a made-up list of names. It also adds a red dot and a name under every tile, so the strip doesn't look like a real logo wall.

## Changes
1. **Top photo**
   - Swap the black picture for the real Site 99 studio photos the site already uses lower down the page (the studio, the call-to-action and the team shots).
   - The photos fade between each other every 7 seconds, with the headline, red glow and button kept on top.
   - Make the dark overlay a little lighter so the photo is clearly visible while the headline stays easy to read.
2. **Logo strip**
   - Show only clients that have an uploaded logo. Clients without one stay hidden until a logo is added.
   - Remove the made-up names, the text-only entries, the red dots and the names under the tiles.
   - Show every logo at the same size on a plain white tile, since your logos always have white backgrounds. The strip keeps its slow, smooth scroll.
   - If no logos exist yet, hide the "In Residency" strip completely.

## Check
- Open the homepage at your current phone-ish width and at desktop. Confirm the photo shows behind the headline and the strip shows only real logos.

## Technical details
- `src/pages/Index.tsx`: change `heroImages` to the `studioAsset`, `ctaAsset` and `mathAsset` URLs, and lighten the gradient overlay. In `marqueeItems`, keep only residents found in `logoMap`, drop `residentsFallback` from the marquee, and render the section only when there are items.
- `src/components/Marquee.tsx`: render logo tiles only (white `bg-white` tile with border, `object-contain`), with no text or separator. Repeat the items enough times to fill the width when there are only a few logos.
