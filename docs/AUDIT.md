# Security and data audit

Scope: Firebase sign-in (PMS bridge), `firestore.rules`, the Firestore data, and the code that writes to it
(the browser app and `api/`). Reviewed against the version in `widebedTMS.zip`.

Nothing was overwritten blindly. The original rules are kept in `docs/firestore.rules.previous` (for rollback).
The original board `main` and the PMS link (`api/*`) behave exactly as before.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | **A person could edit almost any field of their own `users` document.** The rule listed what they could NOT change (role, department, pmsRole, email, stub), so anything else was open: `employeeId`, `jobTitle`, `createdAt`, `lastLoginAt`, and a `photo` of any size. | **Fixed.** Now an allow-list: only `displayName`, `photo` (under 40 KB), `timezone`, `landingPage`. Employee ID and job position are set by a Director (Staff page). |
| 2 | Medium | **A task's assignee or creator could change fields that are not theirs:** `createdBy`, `boardId`, and PMS fields (`pmsKey`, `pmsLink`, `source`). Anyone could also create a task carrying fake PMS fields. | **Fixed.** Those fields are locked for everyone except a Director on update, and cannot be set on create. The app never changes them, and `api/` uses the Admin SDK, so nothing legitimate is affected. |
| 3 | Medium | **`task_activities` can be read by every signed-in person** (titles and notes from other departments), and anyone can write a log line for any task. | **Not changed, on purpose.** `api/pms-task.js` writes to this collection, and a rule can only protect it if each log line carries a `boardId`. Recommended next step: add `boardId` to new log lines in the app and the API, then restrict reads to people who can open that board. |
| 4 | Medium | **A drag that the server refused left the card in the wrong place on screen** until the next reload (the screen and the saved data disagreed). | **Fixed.** The board reloads from saved data when a move or a column reorder is refused. |
| 5 | Low | **`auth.profile` was read once at sign-in.** If a Director changed someone's role or department, their screen kept the old buttons until they signed in again (the server enforced the new role at once, so buttons failed). | **Fixed.** The profile is now live. |
| 6 | Low | **Two columns (or cards) with the same position could swap places** between reloads. | **Fixed.** Ties are broken by ID everywhere. |
| 7 | Medium | **A person with no department (`departmentId: null`) matches every task whose department is also empty** (`null == null`), so they can read and edit those. | **Not changed (it changes behaviour).** One-line fix when you are ready: in `inMyDept`, add `myDept() != null &&`. Until then, assign departments to new staff soon after they first sign in. |
| 8 | Low | **Every signed-in person can read the whole `users` list** (names, emails, roles). | **Accepted.** The assignee pickers and member lists need it. |
| 9 | Info | `.env.example` is committed with your real Firebase web config. That config is public by design (it identifies the project; the rules protect the data), so this is fine. The zip you sent also contained `.env.local`. It has no private key in it, but keep it, and the service-account file, out of zips and out of git. | Advice |
| 10 | Info | The `api/` functions have no rate limit. Consider Vercel's firewall or rate limiting. | Advice |
| 11 | Info | The catch-all `match /{collection}/{id}` deny rule has no effect (rules are additive). | Left as is |

## Data integrity notes (accepted limitations)

- `tasks.status` is a text copy of the column name; `columnId` is the real link. When a Department Manager renames a
  column, only the tasks they can see get the new text.
- Card positions are halved on every drop between two cards. After roughly 40 drops into the same gap the positions
  can no longer be told apart. Renumbering a column would need permission to edit every card in it, so it is not done automatically.
- `completedAt` is set by the browser (server timestamp) when a card enters a completed column. Changing a column to
  "counts as completed" does not back-fill cards already in it (the app warns about this).
- Task history (`task_activities`) is not moved or rewritten.

## Compatibility checks that were made

- `api/pms-task.js` still finds board `main` and its columns by `boardId == 'main'`: unchanged.
- No task, column, dashboard or user document was modified by this work. New data is additive (`workspaces`, `boards`, `users/{uid}/settings/stars`).
- Rules for a board WITHOUT a board document are your previous rules, plus the field locks in finding 2.
- Your 12 PMS tests still pass.
