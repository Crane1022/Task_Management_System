# Enhancement update: attachments, comments, 15-record activity, Super Private, Main Board

## Safe order to roll this out
1. Back up Firestore (export) and keep a copy of the current `firestore.rules`.
2. Run the migration in a dry run first, then for real. It uses your own service account; nothing is in the repository.
       set TMS_SERVICE_ACCOUNT_FILE=C:\path\to\service-account.json
       node scripts/migrate-workspaces-and-activity.mjs            (dry run, changes nothing)
       node scripts/migrate-workspaces-and-activity.mjs --apply
   It sets `superPrivate: false` on every existing workspace (so nothing becomes private and Directors still list them),
   rewrites each task's newest 15 activity records into numbered slots, and deletes older/orphan records. Safe to run twice.
3. Publish the new `firestore.rules` (Firebase console > Firestore > Rules).
4. Deploy the app (and the `api/` folder) in your usual way. Nothing here deploys itself.
Do step 2 BEFORE steps 3 and 4: the new Director workspace listing relies on the `superPrivate` field being present.

## What changed
- Attachments: external links only (Drive, OneDrive, SharePoint, Dropbox, company file server). No upload, no Storage. Max 30 per task, links must be http(s).
  Optional: `VITE_FILE_SERVER_HOSTS=files.widebed.com.my,nas.widebed.local` to recognise your own file server.
- Comments: `tasks/{taskId}/comments`, author and server time, edit only by the author, delete by the author or someone who can manage the board.
- Activity: at most 15 records per task, enforced in `firestore.rules` and in the API. Records use fixed ids `<taskId>_<0..14>`; the task's
  `activitySeq` must go up by exactly 1 with each record, so two writers cannot claim the same slot, and the 16th record overwrites the oldest. Comments and attachments are never touched.
- Super Private workspace: unchecked by default. Only the owner (`createdBy`) and members the owner adds can read it, its boards, tasks, comments and activity.
  Director/Admin roles do not bypass it. Only the owner changes its members or the setting.
- Profile: Employee ID and Job position are no longer shown in the TMS profile page (data untouched).
- Password fields: eye toggle on login and the three profile password fields.
- Top bar: only the Dark mode toggle and Profile button on the right; search, department and New task moved into a toolbar under the bar.
- Main Board: shows tasks of every workspace you can access, in the column with the same name as the task status. New task on Main asks for a workspace;
  on a workspace board it is set automatically. Same task records, so both views update live. Move between workspaces only offers destinations you may create in.

## Limitations
- Main Board matches columns by status name. Tasks whose status has no matching column on Main appear in "Other statuses".
- Dragging on Main places a task in the same-named column of its own board; if that board lacks it, the drop is refused with a message.
- Moving many tasks at once runs 3 per batch (each task also moves its activity).
- Tasks created by the PMS on the legacy `main` board still follow the old department rules.
- Old random-id activity is trimmed when a task next changes, and fully by the migration script.
- The Firestore rules tests need the Firebase emulator and were skipped here (see below).

## Manual checks still needed in a real browser
Drag and drop (cards and columns), touch drag, the Main Board with several workspaces, Super Private with two real accounts (owner, member, Director),
dark mode on every page, and mobile layout. jsdom cannot check these.

## Notifications and @mentions (the bell)

The bell sits in the top bar on every page. Each person has their own list at `users/{uid}/notifications` (newest 50 are kept).

| Notification | Made by |
| --- | --- |
| A task is assigned to you | the app, when a task is created or its assignees change |
| Comment on your task | the app, when someone comments on a task you are assigned to or created |
| @mention in a comment | the app; type `@` in a comment, pick a name. A mentioned person gets this instead of the plain comment notice |
| Task moved / completed | the app, on drag-and-drop, the status dropdown and "move to board" (to the assignees and creator) |
| Added to / removed from a workspace | the app, from the Members tab |
| Due today / due tomorrow / overdue | `api/deadline-reminders.js`, run once a day by Vercel Cron (09:00 Malaysia time) |

You never get a notification for your own action. Clicking one opens the task (`/b/<board>?task=<id>`) or the workspace.

**To switch it on** (nothing here is done for you):
1. Publish `firestore.rules` (new `users/{uid}/notifications` rules; comments may now carry `mentions`).
2. Deploy `api/` and `vercel.json`.
3. In Vercel add the environment variable `CRON_SECRET` (any long random string; Vercel Cron sends it as a Bearer token). Optional: `REMINDER_UTC_OFFSET_HOURS` (default 8).

Not built: e-mail. It needs a mail provider and its key. Notifications are best effort: if one cannot be saved, the task action still succeeds.
