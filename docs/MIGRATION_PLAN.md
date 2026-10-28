# Workspaces and boards: migration plan

## The idea in one paragraph

Nothing is migrated automatically. A board that has **no board document** (today: only `main`) keeps the department
rules it has now, so the app, the PMS link and everybody's access stay exactly as they are. A board that **has a
document** belongs to a workspace and follows workspace roles. New work happens in new workspace boards. If, and
when, you want the original board inside a workspace too, a Director adds the `boards/main` document with one button.

## What is added (all additive)

| Path | Contents |
|---|---|
| `workspaces/{id}` | `name, description, icon, color, archived, createdBy, createdAt, updatedAt, members: {uid: 'admin'\|'member'\|'viewer'}, memberIds: [uid]` |
| `boards/{id}` | `workspaceId, name, description, background, archived, members: {uid: role}` (a board-level role for one person), `createdBy, createdAt, updatedAt` |
| `users/{uid}/settings/stars` | `{ boardIds: [...] }` (a person's starred boards) |
| `users/{uid}/settings/preferences` | notification choices |
| `users/{uid}` | new optional fields: `displayName, photo, timezone, landingPage` (self), `employeeId, jobTitle` (Director) |

How this differs from the suggested layout: members live **on the workspace document** (a map plus a list) instead
of a `members` sub-collection. One document means one atomic write and one lookup in the security rules, and the
list is what lets Firestore answer "which workspaces am I in?". Board roles are a map on the board for the same reason.
Columns stay in the top-level `columns` collection (with `boardId`), and tasks stay in `tasks`, so **no task or column is moved, copied or renamed**.

## Roles

- **Director** (`super_admin`): admin everywhere, sees every workspace.
- **Workspace admin**: manages the workspace, members and boards; admin on every board in it (columns, board settings).
- **Workspace member**: creates and updates tasks on every board in the workspace.
- **Workspace viewer**: read only.
- A board admin can give one person a different role on that board only (cannot lower a workspace admin).
- Who can create a workspace: Directors and Department Managers (the creator becomes its admin).
- Anyone assigned a task can still read that task, as before (PMS tasks are assigned across departments).

Employees are never duplicated: members are the existing `users/{uid}` records (Firebase uid = PMS uid).

## Safe order of work

1. **Back up.** Firebase console > Firestore > Import/Export, or `gcloud firestore export gs://<bucket>/before-workspaces`.
2. **Publish the new `firestore.rules`.** They are compatible with the old app, so this is safe to do first. Check in the Rules Playground, or run `test/rules.test.js` on the emulator.
3. **Deploy the app** (push to GitHub / Vercel as usual). No indexes are needed.
4. **Use it quietly.** Create a workspace, add people, create a board, add a task. Nothing about `main` changes.
5. **Optional: bring the Main board into a workspace.** Workspace > Settings > "Add the original Main board". Before pressing it, understand the effect: access to `main` stops depending on the **department** and starts depending on **workspace membership** (plus Directors and assignees). Use "Also add everyone who has signed in" so nobody loses access, and expect that everybody in the workspace will then see all departments' tasks on that board.
6. **PMS link:** unaffected either way (it writes with the Admin SDK and finds the board by `boardId == 'main'`).

## Rollback

- Undo step 5: delete the single document `boards/main` in the Firebase console. The department rules apply again at once.
- Remove workspaces: archive them in the app (or delete the `workspaces/*` and `boards/*` documents).
- Rules: republish `docs/firestore.rules.previous`.
- Tasks, columns, dashboards and users were never rewritten, so there is nothing to restore.

## Required Firestore indexes

None. Every query is one equality filter, two equality filters, or `array-contains` on its own.

## Known limits of this design

- Tasks are listed per board; the Dashboard, List and My Tasks pages show **one board at a time** (the picker in their header). A cross-board "all my tasks" view is not built.
- Moving a task to a different board is not built (the rules lock `boardId`).
- Boards are visible to the whole workspace (with per-board roles); invite-only (private) boards are not built.
- Board counts on the overview are loaded when the page opens (Refresh reloads them); fine for dozens of boards and a few thousand tasks.
- Permanently deleting a board only works for an archived board with no tasks; archive everything else.
- Notifications are not sent yet (the profile page saves the choices).
