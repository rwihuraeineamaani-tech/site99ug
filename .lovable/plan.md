# One home for every client / resident

## What I found
- All 14 clients already sit in one Residents list, but the website editor has its **own separate resident form** (name, territory, visible) and its own social-accounts editor, so people edit clients in two places with different fields.
- Website projects store the client as **typed text**, not a link. Of 6 projects only 2 are linked to a Resident: "The Lawns Restaurant" and "MOGAS GROUP" are typed names that match Residents but aren't linked; "General", "Self" and "In House" match no Resident.

## What changes
1. **Residents (in the team system) becomes the only place to add or edit a client.** The website editor's Residents tab is replaced by a read-only list with an "Open in Residents" button. The website on/off switch, territory, "since" year and display order move into the Resident record under a "Website" section.
2. **Social accounts** editing moves into the Resident record too (same data, one editor).
3. **Projects pick a client from the Residents list** instead of typing a name. Options: a Resident, or "In house / Site 99" for your own work. The typed name stays only as a fallback label.
4. **Link the existing projects once:** The Lawns Restaurant and MOGAS Group projects linked to their Residents; "In House", "Self" and "General" marked as in-house.
5. **Public website** keeps showing only clients switched on for the website, now read from the same record.

## Technical details
- Admin.tsx: remove ResidentsAdmin form and AccountsEditor; replace with list linking to /app/residents/:id. Project form: resident select (writes resident_projects + sets `client` label from resident name), "In house" option.
- ResidentRecord.tsx: add Website section (visible, territory, since, display_order, avatar) and social accounts (client_accounts) editor, restricted to site_editor/admin/leadership.
- Data fix via SQL: insert resident_projects rows for the two matching projects; normalize in-house labels.
- No table deletions; check RLS lets site editors update the website fields on residents.

Question to confirm on approval: projects for "General"/"Self" will be treated as in-house work.
