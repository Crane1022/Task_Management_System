# Link with the Widebed PMS

The Task Management System (TMS) and the Widebed PMS are two separate Firebase projects. Neither reads the other's database. Two Vercel functions in `api/` connect them. Both check the caller's **PMS ID token** with `firebase-admin`, using only the PMS project ID (`widebed-pmsdashboard`). They then read the caller's PMS staff record `users/{uid}` (role, active) from the PMS REST API, using the caller's own token. No PMS key is needed and none is shared.

| Function | Called by | What it does |
|---|---|---|
| `POST /api/pms-login` | the TMS login page | Takes a PMS ID token and returns a TMS custom token for the **same uid**. On the first sign-in it creates `users/{uid}` (`employee`, no department, `pmsRole`). It never overwrites role or department. |
| `POST /api/pms-task` | the PMS (`src/lib/tms.js` there) | `create` (Directors only), `update` (Director, an assignee or same-department Procurement: note, completed, checklist ticks or full checklist sync), `list` (by `pmsLink`), `inbox` (unlinked tasks of a department), `link` (point a board task at a PMS record) |

Staff sign in here with their **PMS email and password**. There is no sign-up. Accounts are made on the PMS Staff accounts page, and a Director (role super_admin) sets department and role on the **Staff** page here. Someone switched off in the PMS is refused at sign-in. A signed-in tab re-checks every 30 minutes and on each load, so they are signed out within half an hour.

## Messages (`/api/pms-task`)

Headers: `Authorization: Bearer <PMS ID token>` and `Content-Type: application/json`. Body: `{ action, taskId?, data }`.

| action | who | data | reply |
|---|---|---|---|
| `create` | Director | `title`, `details`, `assigneeUids[]` (PMS uids), `dueDate` `'YYYY-MM-DD'`, `departmentId` (optional, an id from `DEPARTMENTS`), `priority`, `subtasks` `['text', …]`, `pmsLink` `{ type, id }` | `{ ok, taskId }` |
| `update` | Director, assignee, or a Procurement user when the task is in the Procurement department | `taskId` + `text` (a note in the activity log), `completed` true/false, `subtasks` `[{ id, done }]` (ticks) **or** `[{ title, done }]` (the whole checklist: same order, ids kept for titles already there, others removed; an unchanged checklist is not an error) | `{ ok, status, completed }` |
| `list` | any active PMS staff | `{ type, id }` (the `pmsLink`) | `{ ok, tasks: [{ id, title, status, completed, departmentId, subtasksDone, subtasksTotal, assigneeUids, dueDate, completedAt, … }] }` |
| `inbox` | Director, Procurement | Director: `departmentId` (default `procurement`); Procurement: always its own department | `{ ok, departmentId, tasks: [{ id, title, description, status, priority, dueDate, createdAt, createdByName, subtasksTotal }] }`: open tasks with no `pmsKey`, oldest first, up to 50 |
| `link` | Director, or a user whose department (from their PMS role) is the task's | `taskId` + `pmsLink` `{ type, id }` | `{ ok, taskId, pmsKey }`; 409 if the task is linked to another record already (the same link again is fine) |
| `maintenanceBoards` | any active PMS staff | none | `{ boards: [{ id, name, pmsPropertyId }] }`: the property boards of the Maintenance workspace |
| `issue` | any active PMS staff who can see the ticket in the PMS | `id` (`IS-0001`), `boardId` (optional: a Maintenance board for a new task) | `{ ok, taskId, boardId, columnId, column, status }`; `taskId: null` with `skipped` for a Completed ticket that has no task yet. See **Maintenance tickets** below |

The PMS New Owner Listings page uses these: Procurement tasks made on the board show in its "From task system" inbox; **Start listing** makes NL-000n and calls `link`; every save sends one `update` (a note of what changed, the listing's checklist as `[{ title, done }]`, and `completed: true` when the listing goes Live). Its Marketing stage `create`s a separate Marketing task (Director) and reads progress with `list`. A department comes from the PMS role (`DEPT_FOR_PMS_ROLE`, procurement -> `procurement`).

New tasks go to the first open board column (the same one the "New task" button uses), at the end of that column. Their checklist items take the TaskModal shape `{ id, title, done }`, and each one gets a `task_activities` entry. `completed: true` moves the task to the board's done column (`isDone`); `false` moves it back to the first open column. With no done column, only `completedAt` is set. If no department is sent, the first assignee's TMS department is used, or a guess from their PMS role, or `management`. An assignee who has never signed in gets a placeholder profile (`stub: true`) built from their PMS staff record.

Errors come back as `{ error }` with status 400 (bad input), 401 (not a PMS login), 403 (no access / not allowed), 404 (no such task), 409 (the board has no columns, or the task is linked to another PMS record).

## Maintenance tickets (PMS Issues <-> the Maintenance workspace)

Every **Customer** ticket on the PMS Issues page (a guest or tenant's problem at a unit), whatever roles are tagged, has one task in the TMS workspace named **Maintenance**. **In-house** tickets (office, staff or company matters) stay in the PMS: they have no property and no task. A ticket changed to In-house has its task removed, and one changed to Customer gets a task once it has a property. Older tickets without a type count as Customer when they have a unit, as on the Issues page. Each property has its own board there. Both sides stay the same, in both directions. The code is in `api/_pms-issues.js` (server), `src/services/pmsIssues.js` (TMS app), and the PMS's `src/lib/tms.js` and Issues page. The mapping is in `api/_lib/issueStatus.js`.

**Which board.** A ticket goes to the board of its property. The board is found by the PMS property ID (saved on the board as `pmsPropertyId`), then by the board's name (the property name, ignoring capitals). Every Customer ticket has a property: the PMS Raise form and Edit window require one for Customer tickets (In-house tickets have no Property field), chosen from the Maintenance boards (the `maintenanceBoards` action). Boards are never made automatically. A ticket with no property (an older one) or a property with no board is refused with the reason, which the PMS shows. It goes in on its next change once that's fixed (Edit the ticket's property, or make the board). When a ticket's property changes in the PMS, its task moves to that board, and moving a card to another property's board in the TMS changes the ticket's property. The task's ID is `issue-IS-0001`, so there is never more than one task for a ticket. Its labels are `PMS`, the ticket number and the unit. Its department is `procurement` when Procurement is tagged before Operations, otherwise `operation`.

**Status.** Column names can be changed freely. A column's place on the board decides what it means:

| PMS status | TMS column |
|---|---|
| Open | the first open column that doesn't count as completed (TODO) |
| In progress | any other open column that doesn't count as completed (DOING, or one you add, e.g. WAITING PARTS) |
| Completed | a column that counts as completed (DONE) |
| Deleted (Directors) | the task is **deleted** in the TMS, with its activity records and comments. The PMS keeps the ticket, marked deleted with its reason. The PMS waits for this before leaving the ticket and says if it failed. Cards left behind (tickets deleted before this, or a failed removal) are removed when anyone opens their Maintenance board, or tries to change the card |

"Not completed" in the PMS is a filter (Open + In progress), not a status. The PMS always shows its own status words (Open, In progress, Completed). The card's TMS column is saved on the ticket as `tmsStatus: { name, for }` and shown only when hovering over the status.

**PMS -> TMS.** After every change on the Issues page (raise, Mark in progress, Mark completed, tags, Edit title & description, Delete), the PMS sends `issue` with only the ticket number. The server reads the ticket from the PMS using the caller's own token, so the PMS rules decide who may see it, and makes or updates the task: title, description and column. A column is only changed when the ticket's status differs from what the card's column stands for.

**TMS -> PMS.** When a ticket's card is moved to another column, or its title or description is edited (task window, drag and drop, Main board, moving to another board, deleting a column), the TMS app writes the ticket in the PMS **first**, as the signed-in person. The browser keeps their PMS sign-in from login. The PMS rules (Draft 0.47) allow Directors and the roles tagged on the ticket, while it is Open or In progress. If the PMS refuses (not tagged, or the ticket is Completed and locked), the card isn't changed either. Renaming a column updates the name shown on its tickets. Assignees, dates, priority and the checklist stay in the TMS only.

**New task on a Maintenance board.** The task form adds the PMS "Raise a ticket" fields (`src/components/PmsTicketFields.vue`), and the button reads **Raise ticket**. It is always a **Customer** ticket, because only those belong in this workspace (In-house matters are raised in the PMS). The fields are: Unit (required: the units of the board's property, read from the PMS, or a typed code for roles that can't read units), Title, "What happened" (the description, required), the roles to tag (their own role is always tagged, Operations is added and can be removed, and at least one role is needed), and Drive links (company Google Drive only; file uploads stay in the PMS). On save, the ticket is raised in the PMS as that person (next IS number; property = the board's property), and the tagged roles are notified as the PMS does. Then the server makes the task on that board, in the column it was added to. Assignees, dates, priority and checklist are saved on the task only. If anything fails, the form stays open. **Deleting a ticket's card in the TMS deletes the ticket in the PMS too**, as the PMS's own Delete ticket does: marked deleted with a reason (asked for in the TMS), never removed. Only PMS Directors see Delete on a ticket's card, because the PMS rules only let Directors delete tickets. The PMS is changed first; if it refuses, the card stays.

**Setup.** 1) Deploy the TMS. 2) Publish the PMS `firestore.rules` Draft 0.47. 3) Deploy the PMS (`tms.js` and the Issues page). 4) Make sure the TMS workspace is named exactly `Maintenance` (or set `MAINTENANCE_WORKSPACE_ID`, with the same name kept), and that the people who move cards are members of it. Existing tickets get their task on their next change.

## Environment variables (Vercel > Project > Settings > Environment Variables)

| Variable | Where | Value |
|---|---|---|
| `VITE_FIREBASE_*` | build | as before (this TMS project) |
| `VITE_PMS_API_KEY`, `VITE_PMS_AUTH_DOMAIN`, `VITE_PMS_PROJECT_ID`, `VITE_PMS_MESSAGING_SENDER_ID`, `VITE_PMS_APP_ID` | build | the PMS web config, already in `.env.example` (public, not a secret) |
| `TMS_SERVICE_ACCOUNT` | functions | the whole service account JSON of **this TMS project** (Firebase console > Project settings > Service accounts > Generate new private key), pasted as one value. **Never** in Git, chat or email. |
| `ALLOWED_ORIGINS` | functions | the PMS site address(es), comma separated, e.g. `https://<pms-domain>,http://localhost:5173`. The TMS's own address is always allowed. |
| `PMS_PROJECT_ID` | functions | optional, defaults to `widebed-pmsdashboard` |
| `MAINTENANCE_WORKSPACE_ID` | functions | optional: the ID of the Maintenance workspace. Without it, the workspace named `Maintenance` is used |

Redeploy after changing them. The `VITE_*` values are baked in at build time.

## What the TMS owner must do

1. Add the variables above in Vercel and redeploy.
2. Publish the new `firestore.rules` (Firestore > Rules). Browsers can no longer create `users` profiles; only `api/pms-login.js` does that.
3. Sign in with your PMS account, then in Firestore set `users/<your PMS uid>.role` to `super_admin` once. After that, use the **Staff** page.
4. Optional: turn off the **Email/Password** provider in this TMS project's Authentication. Sign-in now uses custom tokens, so it isn't needed.
5. Accounts made by the old self sign-up have different uids from the PMS ones. Their old tasks still point at the old uids, so reassign those tasks (or remove the old `users` docs) once people have signed in with their PMS accounts.
6. Vercel plan: the free Hobby plan is for non-commercial use only. A company system may need **Pro**.
7. Send the PMS team the endpoint address: `https://<tms-domain>/api/pms-task`.

## Tests

`npm test` runs `test/pms-api.test.js`. It drives both handlers against an in-memory Firestore and a fake PMS REST API, with no network or project needed.
