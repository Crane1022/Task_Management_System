# Widebed Tasks

Task management app for Widebed: Vue 3, Vite, Tailwind, Pinia, Firebase (Auth + Firestore).
Firebase is loaded from Google's CDN (no `firebase` npm package); see `src/firebase/sdk.js`.
Shares one Firebase project (and the Auth UID as employee identity) with the Widebed Dashboard.

## What works in this first version

- Sign in with the Widebed PMS email and password (no sign-up here; new people start as `employee`). See docs/PMS_LINK.md
- Real-time Kanban board: drag cards between and within columns, order is saved in Firestore
- Add, rename and delete columns (Super Admin / Department Manager)
- Task side panel: title, description, status, priority, department, category, assignees,
  start/deadline, estimated hours, labels, checklist with progress, activity log
- Search and filters (employee, department, priority, deadline), "My tasks" view
- Customizable dashboards (private to each person, saved in Firestore): add, remove, reorder and resize widgets, rename them, pick a colour set, and create several dashboards
- List view (sortable table) alongside the Kanban board
- Natural green theme with little cats that pop up when you hover (or tap) them
- **Appearance & Theme** (sidebar > Account): Light, Dark, System and Moss / Clay / Sky / Blossom / Sand / Dusk presets; custom colours, text size, corner roundness, background image and overlay; live preview; reset. Applies to the whole app, one dashboard, or one page (page beats dashboard beats global)
- **Backgrounds**: built-in gallery (forest, leaves, mountains, sky, paper, gradient, pattern) or your own JPG/PNG/WebP up to 5 MB, shrunk in your browser and stored privately in Firestore (Firebase Storage is not needed)
- **Calendar** (sidebar › Calendar; on a phone, the List | Calendar switch): tasks by deadline, a month or a week at a time. Click a day to see its tasks; drag a task to another day to move its deadline; "Add a task on …" starts a task with that deadline
- **Select many in List**: tick tasks (on a phone press and hold, or tap Select), then Move to / Assign / Priority / Deadline / Delete for all of them at once
- **Undo**: deleting tasks (one or many) shows an Undo message for 6 seconds before they are really deleted. PMS tickets and listings are deleted straight away, as before (their delete goes through the PMS)
- **Search** finds people by name (click one to see only their tasks), and looks through task titles and descriptions, who tasks are assigned to, the names of attached files, and comments (from 3 letters, on the 80 most recently changed tasks of the board), with the results grouped under the search box
- **Dependencies** (task window › Dependencies): the tasks this one waits on and the ones it holds up. A task still waiting on something can't be moved to a "counts as completed" column; its card shows "Waiting on N". Stored as `blockedBy` (task IDs, at most 20; firestore.rules)
- **Offline**: Firestore keeps a copy of the data on the device, so the app opens and works with weak or no signal; a banner says when you're offline and when your changes are saved again
- **Friendly messages**: errors such as `permission-denied` are shown as plain sentences (src/utils/errors.js); the no-access board page says who to ask
- **Welcome tour**: six short steps the first time someone signs in on a device; Profile & settings › Show the welcome tour again
- **Motion**: src/styles/motion.css (now imported in main.js) holds the transitions used everywhere; all of it switches off with Reduce motion
- **Task attachments**: upload pictures and files (PDF, Word, Excel, PowerPoint, zip… up to 5 MB each) with the button, by dragging them onto the Attachments area, or by pasting a screenshot with Ctrl+V; or add a link to Google Drive / OneDrive / SharePoint / Dropbox / the company file server. Photos are shrunk in the browser (max 1920 px) and get a preview picture; other files are split into pieces of ~700 KB and kept in Firestore under `tasks/{taskId}/files/{fileId}/chunks/{n}` (Firebase Storage is not needed). Files have the same permissions as their task (firestore.rules). Programs and web pages (.exe, .bat, .js, .html…) are blocked; only pictures are shown in the app, PDFs open in a new tab, everything else downloads. Removing the attachment or deleting the task deletes the file too
- **Draggable Kanban columns** (grip handle), saved to Firestore and synced live; column colour, task limit, "counts as completed", archive/restore, and delete with a "move the tasks to..." step
- Light/dark mode, collapsible sidebar, mobile menu, toasts, skeleton loading, error and empty states
- Firestore Security Rules (`firestore.rules`) and read-only dashboard helpers (`src/services/taskQueries.js`)

Not built yet: Workspaces and boards (see docs/ARCHITECTURE.md for the migration plan), profile and account settings, Calendar view, projects, reports, notifications, comments and file attachments, team management.

## Festive companion (25 Nov 2026)

- **Festive events** page (sidebar > Admin, Directors only): whole-company switches, and each special day's date, outfit,
  background decorations, greetings (`{name}`, `{pet}`), pop-up and **who sees it** (everyone, or only the people picked).
  "Add Malaysian festivals" adds Christmas, New Year, Chinese New Year, Thaipusam, Valentine's Day, Ramadan, Hari Raya
  Aidilfitri, Wesak, Kaamatan, Gawai, Hari Raya Haji, Merdeka, Malaysia Day, Halloween and Deepavali. Festivals that move
  every year (lunar/Islamic calendar) show **Needs date** until a Director adds that year's date.
- Everyone: decorations behind the app, the pet's outfit and greeting on the day, a pop-up the day before (once),
  Ramadan (fasting lines by day, buka puasa countdown from 3 pm), morning coffee, "Time to rest" after 9 pm, an umbrella
  when it rains, Monday/Friday lines, and their own birthday (set privately in My companion).
- **Free festive wardrobe** (My companion > Festive wardrobe): outfits are kept after the festival; the
  "New outfit unlocked" message shows once per outfit. Each person can switch festive effects off for themselves.
- Data: `festive/settings`, `festive_events/{id}` (rules: only Directors write; a "selected" event can only be read by the
  people in `audienceIds`), and each person's `users/{uid}/settings/festive`. **Publish the new `firestore.rules`.**
- Weather: Open-Meteo (free, no key) from the browser. Buka puasa time: `/api/prayer-times` (JAKIM e-Solat, needs Vercel);
  without it the Director's fallback time is used.

## Run locally

```bash
npm install
cp .env.example .env.local     # then fill in your Firebase web app values
npm run dev
```

## Firebase setup

1. Firebase Console: create a **Firestore** database. (Sign-in uses PMS accounts and custom tokens, so the Email/Password provider can stay off.)
2. Copy the contents of `firestore.rules` into **Firestore > Rules** and publish.
3. Set the Vercel environment variables in docs/PMS_LINK.md, sign in with your PMS account, then in Firestore open `users/<your PMS uid>` and set `role` to `super_admin`.
4. Reload the app and press **Create default columns** (NEW PROJECT, TODO, DOING, REVIEW, DONE).
5. After that, a Super Admin sets everyone's department and role on the **Staff** page.

Accounts are made in the PMS (Staff accounts page). Switching someone off there blocks them here within half an hour.

## Deploy

**Vercel:** push to GitHub, import the repo, add the `VITE_FIREBASE_*` and `VITE_PMS_*` variables and the server variables in docs/PMS_LINK.md, deploy.
`vercel.json` routes every path except `/api/*` to the app. The PMS link (`/api/pms-login`, `/api/pms-task`) needs Vercel; on Hostinger only the app itself runs.

**Hostinger:** run `npm run build`, upload the contents of `dist/` to `public_html`
(the `.htaccess` in `public/` is copied into `dist/` and handles page routes), or connect the GitHub repo.

**Subdomain (tasks.widebed.com.my):** add the domain in Vercel/Hostinger, create the DNS record they show,
then add the domain under Firebase **Authentication > Settings > Authorized domains**.

## Using it from the Widebed Dashboard

Point the Dashboard at the same Firebase project and import the functions in
`src/services/taskQueries.js` (`getEmployeeTasks`, `getDepartmentTasks`, `getCompletedTasks`,
`getOverdueTasks`, `completionRate`). Task completion rate is a statistic, not a KPI score.

## Data model (current)

`users`, `columns`, `tasks`, `task_activities`, `dashboards` (`ownerId`, `name`, `palette`, `widgets[]`). A task stores `columnId`, `status`, `position`
(spaced by 1000; a dropped card takes the midpoint), `completedAt` (set when it enters a column marked `isDone`),
plus the fields from the original spec.

## Testing checklist

1. **Theme**: open Appearance & Theme, pick *Dusk*, press Save. The whole app turns dark purple. Reload: it stays.
2. **Scope**: choose "A specific page" > Kanban Board, pick *Sky*, Save. Only the Kanban page changes. Dashboard and List keep the global look.
3. **Dashboard scope**: on the Dashboard press Customize > Colours and background > "Current dashboard only", pick a gallery image, Save. Create a second dashboard: it should not have the image.
4. **Upload**: upload a PNG under 5 MB (shows progress, then Save). Try a PDF and a 10 MB image: both should be refused with a message. Remove it and confirm the document disappears from `users/{uid}/backgrounds` in Firestore.
5. **Reset**: press Reset in each scope; that scope falls back to the one above.
6. **Columns**: drag a column by its grip, reload (order stays), open the board in a second browser (order updates live).
7. **Column menu**: change colour, set a limit of 1 and add two tasks (badge turns red), archive then restore, delete a column that has tasks (you must pick where they go).
8. **Regression**: drag a task between columns, reorder tasks in a column, edit a task, use List and My Tasks, hover the cats.
#   T a s k _ M a n a g e m e n t _ S y s t e m 
 
 
## Workspaces, boards and profile

- **Workspaces** (sidebar): a department or working group, with its own members and boards. Roles: Admin, Member, Viewer.
- **Boards**: several per workspace; star them, archive them, duplicate their column layout, give someone a different role on one board.
- **Workspace overview**: starred boards, board preview cards with task / done / overdue counts, search, sort and filter, members, settings.
- **Profile and settings** (top-right avatar): photo, display name, landing page, time zone, notification choices, password, sign-in details.
- The original board (`main`) and the PMS link keep working unchanged. See `docs/MIGRATION_PLAN.md`, `docs/AUDIT.md` and `docs/TESTING.md`.
- Rules changed: publish `firestore.rules` (the previous version is in `docs/firestore.rules.previous`). No new indexes.

## Virtual pet (My companion)

Each employee can choose one of 24 animals (the five original cats, bunny, dog, mouse/tikus, hamster, capybara, panda, bear,
duck, fox, penguin, frog, turtle, red panda, otter, raccoon, koala, chicken, pig, cow) or upload their own picture, recolour it,
add a name and an accessory, put a photo on its face, and drag it anywhere. Choices sync through Firestore
(`users/{uid}/settings/companion`, no rules change); pictures stay on the device. See `docs/COMPANION.md`.
