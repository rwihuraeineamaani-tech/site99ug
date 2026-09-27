# Department SOPs (Standard Operating Procedures)

## What you get
- An **SOPs** tab inside every department in the sidebar: Content Pipeline, Shoot days, Residents, Sales, Finance, Legal, Talent & Campaigns, Client Relations, Communications, Strategy, HR, Operations, Design and System Administration.
- A company-wide **SOP Library** page in the Overview menu. You can search all procedures, filter by department and see what changed recently.
- Each SOP is a detailed document with these parts:
  - Purpose, scope and owner (a position)
  - When it applies, and what's needed before starting
  - Numbered steps. Each step says who does it, which Site 99 page to use, the expected output and a time limit
  - Approvals and sign-offs, with a link to the approval flow it uses
  - Common mistakes, what to do when something goes wrong, and who to escalate to
  - Templates, checklists and links
  - Related SOPs
- Every change is saved as a new **version**, showing who changed it and what changed. You can compare and restore older versions.
- **Read confirmation:** staff tick "I have read this version". The SOP owner and leadership can see who hasn't read the latest version. When an SOP is updated, it goes back to "unread" for everyone.
- The help (?) button on each page links straight to that department's SOPs.

## Who can do what
- **Edit, publish, archive or restore:** only the System Admin (site99ug@gmail.com) and Founders. The database enforces this, not just the screen.
- **Read:** all staff can read published SOPs. Drafts are visible only to editors.
- **Clients and talent:** never see SOPs.

## Starting content
I'll write a full first set of detailed SOPs (about 3–6 per department) based on how Site 99 already works in the app, for example:
- Client onboarding (9 steps, MD sign-offs)
- Invoice to PIN-released payment to Cashbook
- Shoot day planning and reporting
- Content idea to posting
- Sales opportunity to Resident
- Talent booking and usage rights
- Strategy map approval
- Monthly KPI close
- Contract lifecycle
- Portal access

All of them start as **drafts** so you can review them and publish.

## Technical details
- New tables: `sops` (department, title, slug, status draft/published/archived, owner_role, current_version, sections JSON), `sop_versions` (snapshot, change_note, edited_by), `sop_reads` (user, sop, version). Each table gets GRANTs and RLS, with an `updated_at` trigger (`set_updated_at`).
- Write policies use `is_system_admin(auth.uid()) OR is_founder(auth.uid())`. Reading requires `is_staff` and published status, or editor access.
- A trigger snapshots each publish into `sop_versions` and bumps the version number.
- The UI reuses the existing department pages and adds a shared `SopList`/`SopEditor` (a structured section editor with ordered steps) and a library route `/app/sops`.
- The starter SOPs are inserted as draft data after the migration.
- Verify at desktop and 428px widths.
