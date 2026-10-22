# Architecture notes

## 1. What exists today (discovered)

| Area | Where | Notes |
|---|---|---|
| Firebase | `src/firebase/sdk.js`, `config.js` | SDK loaded from Google's CDN, config from `VITE_FIREBASE_*` |
| Auth | `stores/auth.js`, `services/userService.js` | Email/password. `users/{uid}` holds name, email, role, departmentId |
| Tasks | `services/taskService.js`, `stores/board.js` | `tasks` collection, `boardId` is always `main`, positions are fractional numbers |
| Columns | `services/columnService.js` | `columns` collection with `boardId: 'main'` |
| Dashboards | `services/dashboardService.js`, `stores/dashboard.js` | `dashboards` collection, owner-only |
| Theme | `utils/themes.js`, `stores/theme.js` | CSS variables on `<html>`, layered: global < dashboard < page |
| Routing | `router/index.js` | `/`, `/board`, `/my-tasks`, `/list`, `/settings/appearance` |

## 2. Data mapping (Phase 2 and 3)

Your prompt suggested `users/{id}/dashboards`, `boards/{id}/columns` and `users/{id}/preferences`.
To avoid moving existing data, the app keeps its current paths:

| Suggested | Actually used | Why |
|---|---|---|
| `users/{uid}/dashboards/{id}` | `dashboards/{id}` with `ownerId` | already in use, already owner-only |
| dashboard background / look | `dashboards/{id}.theme` | new field on the same document |
| `users/{uid}/preferences` | `users/{uid}/settings/appearance` | `{ global, pages: { board, list, ... } }` |
| `boards/{id}/columns/{id}` | `columns/{id}` with `boardId` | no migration needed |
| column colour, limit, archive | `columns/{id}.color / .limit / .archived / .isDone` | optional fields, missing = off |
| uploaded images | Firestore `users/{uid}/backgrounds/{id}` (shrunk to under about 600 KB) | Storage is not available on this project; settings keep only the image ID. To move to Storage later, only `services/themeService.js` changes |

A theme "layer" looks like:
`{ preset, colors: {primary, secondary, accent, background, surface, text, border}, fontSize, radius, background: {type, id | imageId, position, size, overlay}, reduceMotion }`.
Any key can be missing, which means "inherit from the layer below".

## 3. Phase 4 (Workspaces and Boards): migration plan

Not implemented yet, because it changes the security model. Proposed safe path:

1. **Back up first**: `gcloud firestore export gs://<bucket>/backup-before-workspaces`.
2. **Add, don't move.** Create `workspaces/{id}`, `workspaces/{id}/members/{uid}` (role: admin | member | viewer) and `boards/{id}`.
3. **Keep task IDs and `boardId: 'main'`.** Create one board document with the ID `main` inside a "WIDEBED Workspace". Existing tasks and columns then already point at a real board with zero rewrites.
4. **Backfill with a one-off Admin SDK script** (run by you, not shipped in the app): add every current user as a workspace member (Super Admin and Department Manager become workspace admins, employees become members) and add a `workspaceId` field to tasks so rules need one lookup instead of two.
5. **Transition rules**: deploy rules that allow access by *either* the old department check *or* workspace membership. Test with real accounts.
6. **Cut over**: once everything works, remove the old department branch. Rollback = republish the previous `firestore.rules`.
7. **Trusted operations**: inviting people or changing workspace roles should be done by Security Rules that only allow workspace admins, or by a Cloud Function (needs the Blaze plan) if you want audit trails or email invites.

Department membership stays linked to `users/{uid}` (the Firebase Auth UID), so there is no second employee table.

## 4. Indexes

None needed for the current queries (they use equality filters only and sort in the browser).
Phase 4 will add queries such as `boards where workspaceId ==` and `members collectionGroup`, which may need one collection-group index. I'll list them with that phase.
