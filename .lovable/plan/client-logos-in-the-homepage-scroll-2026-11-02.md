# Client logos in the homepage scroll

The scrolling strip of client names on the homepage will show each client's logo instead of plain text.

## What visitors will see
- Each client in the scroll shows its logo, sized evenly and set in a soft grey that turns full colour on hover.
- The client's name stays underneath in small type (or as hidden alt text if you prefer logo only), so it still reads well.
- Clients without a logo yet (5 of the 11 shown today) fall back to their name in the current style, so nobody disappears from the strip.
- The red dots between clients stay.

## Where logos come from
- The same logos the System Admin already uploads on each client's record. Nothing new to manage: upload a logo there and it appears in the scroll.

## Technical details
- Logos live in the private `client-logos` store, so visitors can't read them today. Add a read-only storage rule letting anyone view a file in `client-logos` only when it is the current logo (`avatar_url`) of a resident marked visible. Hidden clients, brand files and every other file stay private.
- `Index.tsx`: pass `avatar_url` into marquee items and resolve them with `logoUrls` from `src/lib/logo.ts`.
- `Marquee.tsx`: render an `<img>` (fixed height, `object-contain`, lazy, grayscale with hover colour) when a logo URL exists, else the current text block.
