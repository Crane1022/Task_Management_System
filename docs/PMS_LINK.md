# Link with the Widebed PMS

The Task Management System (TMS) and the Widebed PMS are two separate Firebase projects. Neither reads the other's database. Two Vercel functions in `api/` connect them. Both check the caller's **PMS ID token** with `firebase-admin`, using only the PMS project ID (`widebed-pmsdashboard`). They then read the caller's PMS staff record `users/{uid}` (role, active) from the PMS REST API, using the caller's own token. No PMS key is needed and none is shared.

| Function | Called by | What it does |
|---|---|---|
| `POST /api/pms-login` | the TMS login page | Takes a PMS ID token and returns a TMS custom token for the **same uid**. On the first sign-in it creates `users/{uid}` (`employee`, no department, `pmsRole`). It never overwrites role or department. |
| `POST /api/pms-task` | the PMS (`src/lib/tms.js` there) | `create` (Directors only), `update` (Director, an assignee or same-department Procurement: note, completed, checklist ticks or full checklist sync), `list` (by `pmsLink`), `inbox` (unlinked tasks of a department), `link` (point a board task at a PMS record) |

Staff sign in here with their **PMS email and password**. There is no sign-up. Accounts are made on the PMS Staff accounts page, and a Super Admin sets department and role on the **Staff** page here. Someone switched off in the PMS is refused at sign-in. A signed-in tab re-checks every 30 minutes and on each load, so they are signed out within half an hour.

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

| Variable | Where | Value |
|---|---|---|
| `VITE_FIREBASE_*` | build | as before (this TMS project) |
| `VITE_PMS_API_KEY`, `VITE_PMS_AUTH_DOMAIN`, `VITE_PMS_PROJECT_ID`, `VITE_PMS_MESSAGING_SENDER_ID`, `VITE_PMS_APP_ID` | build | the PMS web config, already in `.env.example` (public, not a secret) |
| `TMS_SERVICE_ACCOUNT` | functions | the whole service account JSON of **this TMS project** (Firebase console > Project settings > Service accounts > Generate new private key), pasted as one value. **Never** in Git, chat or email. |
| `ALLOWED_ORIGINS` | functions | the PMS site address(es), comma separated, e.g. `https://<pms-domain>,http://localhost:5173`. The TMS's own address is always allowed. |
| `PMS_PROJECT_ID` | functions | optional, defaults to `widebed-pmsdashboard` |

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
