# Website Resident review queue

## Goal
Give the sole System Administrator a safe place to resolve website client names that are not connected to the single, canonical Residents database.

## Confirmed current state
- Website projects still carry a readable client name, while the authoritative relationship is stored separately as a project-to-Resident link.
- The current six website projects include four linked projects and two unlinked projects labelled **In house**. Those in-house items are intentional and must not appear as missing Residents.
- Website editors can currently manage project links, but this review queue will be visible and actionable only to the System Administrator.

## What will be built
1. **Review queue in Website → Residents**
   - Add a “Needs review” summary above the existing Resident directory.
   - Show each external website client reference that has no canonical Resident link.
   - Group repeated references by normalised client name so the administrator resolves them once.
   - Show the affected projects and when each reference was last updated.
   - Exclude recognised internal labels such as “In house” and “Site 99”.

2. **Link to an existing Resident**
   - Search and select an existing Resident.
   - Show likely name matches first without linking automatically.
   - Confirm the action, link every affected project to the selected Resident, and update the project’s readable client label to the canonical Resident name.
   - Refresh the queue, website project list, and Resident queries immediately.

3. **Create a canonical Resident**
   - Open a compact form prefilled from the website client name.
   - Require the minimum Resident fields: name, area/category, and starting year; allow optional email.
   - Create the Resident as hidden from the public website by default, then link every affected project to it.
   - Open the new Resident record afterward so the administrator can complete onboarding and website details.

4. **Safety and permissions**
   - Add one database function for the atomic create-and-link operation so a partial save cannot leave duplicated or unlinked data.
   - Restrict both linking actions to the System Administrator role at the database level, not only in the screen.
   - Prevent duplicate links and reject attempts to create a Resident whose normalised name already exists; direct the administrator to link the existing record instead.
   - Record each resolution in the existing activity trail.

5. **Verification**
   - Test an unlinked external reference through both actions: link existing and create new.
   - Confirm in-house projects remain excluded, resolved items leave the queue immediately, project labels match the canonical name, and non-admin users cannot run either action.
   - Verify desktop/mobile layouts and the preview build.

## Technical notes
- The queue is derived from website projects with no `resident_projects` relationship; it does not create another client table.
- Canonical identity remains `residents.id`; the project text field remains a display fallback for the public website.
