# Website editor UI refresh

## Goal
Turn **Site 99 Manager** into a cleaner, faster editing workspace that feels consistent with the rest of the signed-in system and works comfortably on phones.

## Visual direction
- Keep the workspace’s existing **Montserrat** typography.
- Use the selected **Studio Red** palette: near-black `#0C0C0D`, raised surface `#171719`, warm white `#F2F0EC`, and signal red `#D92822`, expressed through the existing semantic theme tokens.
- Replace the horizontal tab strip with an **editor sidebar** on desktop. On mobile, use a compact section selector/drawer so the editing area remains full width.
- Use restrained square-to-small-radius surfaces, fine separators, clear status colours, and red only for primary actions and important states.

## What will change
1. **Editor frame and navigation**
   - Give the page a clear title, current-section context, and a link to view the public website.
   - Organise Projects, Residents, Briefs, Announcements, Messages, Access Requests, Team, and Events in a persistent section menu.
   - Keep the existing role-based visibility for Team and editing access.

2. **Projects workspace**
   - Separate the project list from the create/edit form so users can scan existing work before opening an editor.
   - Improve field grouping for project details, resident linking, cover media, gallery media, links, and display settings.
   - Add clear media previews, selected-resident states, save/cancel placement, loading feedback, and safer delete presentation without changing current data behaviour.

3. **Other editor sections**
   - Restyle Residents as a clear read-only directory with website visibility and direct links to the single Residents record.
   - Give Briefs and Announcements standard composer areas and easy-to-scan published/draft lists.
   - Improve Messages into a practical two-pane conversation view on desktop and a simple conversation flow on mobile.
   - Present Access Requests and Team information with clearer status, identity, and action hierarchy.

4. **Mobile and accessibility pass**
   - Prevent clipped controls and sideways page scrolling at 428px.
   - Use full-width form actions where helpful, 16px form text, comfortable tap targets, visible focus states, proper labels, and confirmation states.
   - Respect reduced-motion preferences; use only subtle section and list transitions.

5. **Consistency and verification**
   - Reuse the system’s semantic colours and shared controls instead of adding a second visual language.
   - Preserve all existing save, upload, resident-linking, publish, messaging, access, and permission behaviour.
   - Check every editor section on desktop and mobile, then verify the preview build and relevant save flows.

## Technical notes
- Refactor the large editor page into focused section components where needed, while retaining the current queries and permissions.
- Update the shared admin shell to support the desktop sidebar and mobile selector without affecting unrelated signed-in pages.
- Record the editor structure decision in the project’s architecture notes during implementation.
