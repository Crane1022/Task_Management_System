# Testing

## Automatic (run on every change)

```
npm test         # 35 tests: your 12 PMS tests + ordering, permissions, board numbers, themes
npm run build
```

`test/rules.test.js` checks the security rules, but needs the Firebase emulator (it is skipped otherwise):

```
npm i -D firebase @firebase/rules-unit-testing firebase-tools
npx firebase emulators:exec --only firestore "node --test test/rules.test.js"
```

## Manual checklist (about 25 minutes, needs a Director, a Manager and two employees)

**A. Nothing broke (original board)**
1. Open `/board` (Main board). Drag a card to another column and reorder cards in a column. Reload: the order is kept.
2. Drag a column by its grip, reload (kept). Archive a column and restore it. Rename one.
3. Change a column's colour and task limit. Mark one "counts as completed".
4. Edit a task (title, dates, checklist, assignees). Use List, My Tasks and the Dashboard widgets. Hover the cats.
5. As an employee of another department: you cannot see the first department's tasks (unless assigned).
6. Create a task from the PMS: it appears in the first open column of Main.

**B. Theme**
7. The default Light theme is cool white and green, not cream. Dark mode toggle in the top bar works. Appearance & Theme still saves per app / dashboard / page.

**C. Workspaces and boards** (Director or Manager)
8. Sidebar > Workspaces > "+": create "IT & Marketing Workspace". It appears with Boards, Members, Settings.
9. Members: add an employee as Member and another as Viewer. Try to make the only admin a member: it is refused.
10. Boards: "Create board" with the standard columns; create another by copying the first one's columns (no tasks come along).
11. Star a board: it shows under "Starred boards". Search, sort and filter the board cards. The cards show task, done and overdue counts.
12. Open the board: add tasks, drag them. Board settings (gear): rename, change the background, give one member the Viewer role on this board only.
13. Sign in as the Member: can add and drag tasks, cannot change columns, cannot create boards. As the Viewer: "View only", cards do not drag, no "+", the task panel is read-only. As an outsider: the board shows "You do not have access".
14. Archive a board (settings): it disappears from "All boards" and shows under the "Archived" filter. Restore it. Delete only works for an archived board with no tasks.
15. Delete a column that has tasks: you must choose where the tasks go.

**D. Bringing in the Main board (optional, Director)**
16. Workspace > Settings > "Add the original Main board", with "Also add everyone". Now the Main board follows workspace roles. Delete `boards/main` in the console to undo.

**E. Profile**
17. Top bar avatar > Profile and settings. Add a photo (shows in the sidebar, the top bar and on cards). Set a display name.
18. Set "Open this page when I sign in" to List, sign out and in: you land on List.
19. Change the time zone: activity-log times change.
20. Change your password with the wrong current password (refused) and the right one. "Email me a reset link" sends a mail.
21. Director > Staff: set someone's Employee ID and job position. They see them (read-only) on their own profile and cannot edit them.
22. Save notification choices (nothing is sent yet).
