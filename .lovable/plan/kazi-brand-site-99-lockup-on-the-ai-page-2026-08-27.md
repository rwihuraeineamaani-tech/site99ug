# Kazi brand + Site 99 lockup on the AI page

Bring the uploaded Kazi identity into `/ai-automations`, and adopt the "powered by" lockup arrangement from the brand sheet as the page's signature.

## 1. Brand assets
- From the uploads, prepare two transparent-background PNGs (crop + background removal), stored as CDN asset pointers:
  - **Kazi mark** — the purple `KAZI` wordmark with the purple pill and white star.
  - **Site 99 lockup** — `powered by` / Site 99 logotype / `AI & AUTOMATIONS`, in white for the black page.
- The uploaded sheets themselves are reference only; nothing is embedded as a full white square.

## 2. The lockup arrangement (the key detail)
Reproduce the bottom-of-sheet arrangement exactly, centred and stacked:

```text
            powered by
           Site 99  [99]
        AI & AUTOMATIONS
```

- Small lowercase "powered by", the Site 99 logotype beneath it, and `AI & AUTOMATIONS` letterspaced underneath at logotype width.
- Used in two places: centred at the very bottom of `/ai-automations` (replacing the current text-only footer), and inside the Kazi product card at small scale.
- Rendered in white on black; generous surrounding silence, nothing else on that row.

## 3. Kazi as a real product panel
The current carousel slide becomes a proper product panel, still positioned after the audit tool:
- Kazi lockup at the top of the card — purple stays, and it is the only colour anywhere on the page.
- Copy taken from the brand sheet:
  - "Kazi means work. It stands for the systems that make everyday work faster and easier, for everyone, and everything. We make your company more intelligent, while keeping the human creativity at its core."
  - Secondary line: "Developed under the AI & Automation sector of Site 99 UG LTD — intelligent workflow systems powered by machine learning and AI."
- The faint four-point star from the sheet appears as a large, very low-opacity white shape behind the panel.
- The "coming soon" cards stay as blurred hairline cards beside it.

## 4. Tagline + demo section
- Add `_work made easier_` as a quiet monospace line above the demo form, matching the sheet's underscore styling.
- Demo section subline becomes "contact us now to get a DEMO — info@site99ug.com", keeping the existing form and mailto link.

## 5. Constraints kept
- Page stays black and white apart from the Kazi purple; no other colour is introduced.
- Header stays logo-free (just the `← Site 99` back link); the Site 99 identity appears only in the bottom lockup.
- Form, audit logic, backend and routing unchanged.

## Technical notes
- Assets: `imagegen--edit_image` to crop/clean and remove backgrounds from `1.png`/`2.png`, then `lovable-assets create` → `src/assets/kazi-mark.png.asset.json` and `src/assets/site99-ai-lockup.png.asset.json`, imported as JSON pointers.
- Files touched: `src/pages/AIAutomations.tsx`, `src/components/ai/ProductCarousel.tsx`, plus a small `src/components/ai/PoweredByLockup.tsx`.
- Purple is added as a single scoped token (`--kazi-purple`) used only by Kazi elements.
