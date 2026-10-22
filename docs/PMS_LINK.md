# Link with the Widebed PMS

The Task Management System (TMS) and the Widebed PMS are two separate Firebase projects. Neither reads the other's database. One Vercel function, `api/pms-task.js`, lets the PMS read and update tasks here. It checks the caller's **PMS ID token** with `firebase-admin`, using only the PMS project ID (`widebed-pmsdashboard`), then reads the caller's PMS staff record `users/{uid}` (role, active) from the PMS REST API with the caller's own token. No PMS key is needed and none is shared.

This adds new files only (`api/`, `test/`, this doc) plus three setup lines: `firebase-admin` in `package.json` (and its lock file), and `vercel.json` now skips `/api/` in its rewrite so the function isn't sent to the app. **Nothing in the TMS app (`src/`), its login or its rules is changed.** Board users and PMS staff are separate accounts; the PMS identifies people by their PMS uid.

| Function | Called by | What it does |
|---|---|---|
| `POST /api/pms-task` | the PMS (`src/lib/tms.js` there) | `create`, `update`, `list`, `inbox`, `link` (below) |

## Messages (`/api/pms-task`)

Headers: `Authorization: Bearer <PMS ID token>` and `Content-Type: application/json`. Body: `{ action, taskId?, data }`.

| action | who | data | reply |
|---|---|---|---|
| `create` | Director | `title`, `details`, `assigneeUids[]` (PMS uids), `dueDate` `'YYYY-MM-DD'`, `departmentId` (optional, an id from `DEPARTMENTS`), `priority`, `subtasks` `['text', …]`, `pmsLink` `{ type, id }` | `{ ok, taskId }` |
| `update` | Director, assignee, or a Procurement user when the task is in the Procurement department | `taskId` + `text` (a note in the activity log), `completed` true/false, `subtasks` `[{ id, done }]` (ticks) **or** `[{ title, done }]` (the whole checklist: same order, ids kept for titles already there, others removed; an unchanged checklist is not an error) | `{ ok, status, completed }` |
| `list` | any active PMS staff | `{ type, id }` (the `pmsLink`) | `{ ok, tasks: [{ id, title, status, completed, departmentId, subtasksDone, subtasksTotal, assigneeUids, dueDate, completedAt, … }] }` |
| `inbox` | Director, Procurement | Director: `departmentId` (default `procurement`); Procurement: always its own department | `{ ok, departmentId, tasks: [{ id, title, description, status, priority, dueDate, createdAt, createdByName, subtasksTotal }] }`: open tasks with no `pmsKey`, oldest first, up to 50 |
| `link` | Director, or a user whose department (from their PMS role) is the task's | `taskId` + `pmsLink` `{ type, id }` | `{ ok, taskId, pmsKey }`; 409 if the task is linked to another record already (the same link again is fine) |

The PMS New Owner Listings page uses these: Procurement tasks made on the board show in its "From task system" inbox; **Start listing** makes NL-000n and calls `link`; every save sends one `update` (a note of what changed, the listing's checklist as `[{ title, done }]`, and `completed: true` when the listing goes Live). Its Marketing stage `create`s a separate Marketing task (Director) and reads progress with `list`. A department comes from the PMS role (`DEPT_FOR_PMS_ROLE`, procurement -> `procurement`).

New tasks go to the first open board column (the same one the "New task" button uses), at the end of that column. Their checklist items take the TaskModal shape `{ id, title, done }`, and each one gets a `task_activities` entry. `completed: true` moves the task to the board's done column (`isDone`); `false` moves it back to the first open column. With no done column, only `completedAt` is set. If no department is sent, the first assignee's TMS department is used, or a guess from their PMS role, or `management`. An assignee who has never signed in gets a placeholder profile (`stub: true`) built from their PMS staff record.

Errors come back as `{ error }` with status 400 (bad input), 401 (not a PMS login), 403 (no access / not allowed), 404 (no such task), 409 (the board has no columns, or the task is linked to another PMS record).

## Environment variables (Vercel > Project > Settings > Environment Variables)

| Variable | Value |
|---|---|
| `TMS_SERVICE_ACCOUNT` | the whole service account JSON of **this TMS project** (Firebase console > Project settings > Service accounts > Generate new private key), pasted as one value. **Never** in Git, chat or email. |
| `ALLOWED_ORIGINS` | the PMS site address(es), comma separated, e.g. `https://<pms-domain>,http://localhost:5173` |
| `PMS_PROJECT_ID` | optional, defaults to `widebed-pmsdashboard` |

Redeploy after changing them.

## What the TMS owner must do

1. Add the variables above in Vercel and redeploy (a preview deploy of this branch first is ideal, so the PMS team can test).
2. Send the PMS team the endpoint address: `https://<tms-domain>/api/pms-task`.
3. Requests (your call, not part of this branch):
   - Add a **Procurement** department to `DEPARTMENTS` in `src/utils/constants.js` (id `procurement`), so Procurement tasks can be made on the board and show in the PMS inbox. The function already accepts it.
   - Let any active PMS staff use `create` (now Directors only), so Procurement can send the Marketing task.
4. Note: `create` makes a placeholder `users/{uid}` profile (`stub: true`) for a PMS assignee who isn't on the board yet, so the card can show a name.
5. Vercel plan: the free Hobby plan is for non-commercial use only. A company system may need **Pro**.

## Tests

`npm test` runs `test/pms-api.test.js`. It drives the handler against an in-memory Firestore and a fake PMS REST API, with no network or project needed.
