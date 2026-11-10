// PMS Issues <-> the Maintenance workspace in the TMS. Plain JS with no imports, so the /api functions and the web app
// (src/utils/issueStatus.js re-exports this file) always use the same mapping. See docs/PMS_LINK.md, "Maintenance tickets".
//
// A PMS ticket (issues/IS-0001) has status 'open' | 'progress' | 'done' | 'deleted'. A Maintenance board's columns map to it:
//   open      <-> the first open column that does not count as completed      (TODO)
//   progress  <-> every other open column that does not count as completed   (DOING, or one you add, e.g. WAITING PARTS)
//   done      <-> a column that counts as completed ("isDone")               (DONE)
// A ticket deleted in the PMS ('deleted') has its task deleted (api/_pms-issues.js).
// So columns can be renamed, added and reordered in the TMS: what decides the PMS status is where a column sits and
// whether it counts as completed, never its name. The column's name is shown in the PMS next to the status.

export const ISSUE_LINK_TYPE = 'issue'
export const ISSUE_ID = /^IS-\d{1,8}$/
export const issueKey = (id) => `${ISSUE_LINK_TYPE}:${id}`
// One TMS task per ticket, with a fixed ID, so two syncs at the same moment can never make two tasks.
// (No "_" in it: activity record IDs are "<taskId>_<slot>".)
export const issueTaskId = (id) => `issue-${id}`
export const isIssueTask = (t) => t?.pmsLink?.type === ISSUE_LINK_TYPE && ISSUE_ID.test(t.pmsLink.id ?? '')

// Every PMS ticket has a TMS task. Its department: the first of these tags on the ticket, otherwise Operations.
export const ISSUE_SYNC_TAGS = { Operations: 'operation', Procurement: 'procurement' }
export const issueDepartment = (tags = []) => tags.map((t) => ISSUE_SYNC_TAGS[t]).find(Boolean) || 'operation'
// Every ticket, In-house or Customer, has a property, and its card goes on the board named after that property.
export const MAINTENANCE_WORKSPACE = 'Maintenance'

// The tag word a PMS role answers to on tickets (as myIssueTag() in the PMS firestore.rules)
export const PMS_TAG_FOR_ROLE = { director: 'Director', finance: 'Finance', it: 'IT', hr: 'HR', operations: 'Operations', procurement: 'Procurement', marketing: 'Marketing' }

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)
const squash = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
// Board name = property name, ignoring capitals, extra spaces and the kind of apostrophe (D'Majestic / D’Majestic)
const nameKey = (s) => String(s ?? '').replace(/[‘’`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
export const sameBoardName = (a, b) => nameKey(a) === nameKey(b)

// ----- the "Raise a ticket" form (same choices as the PMS Issues page) -----
export const TICKET_TYPES = [
  { id: 'customer', name: 'Customer', hint: "A guest or tenant's problem at a unit" },
  { id: 'inhouse', name: 'In-house', hint: 'Office, staff or company matters' },
]
// The roles a ticket can be tagged to, in the PMS order (roles made on the PMS Roles page are added by name)
export const BASE_TICKET_TAGS = ['Director', 'IT', 'Admin', 'HR', 'Finance', 'Operations', 'Procurement', 'Marketing']
export const tagLabel = (g) => (g === 'Finance' ? 'Accounting' : g) // "Finance" is shown as Accounting in the PMS
// Which PMS role is notified for a tag (Admin has no sign-in role: Directors cover it)
export const ROLE_FOR_TAG = { Director: 'director', IT: 'it', Admin: 'director', HR: 'hr', Finance: 'finance', Operations: 'operations', Procurement: 'procurement', Marketing: 'marketing' }
// Ticket links must be company Google Drive links (as the PMS checks)
export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com']
export const MAX_TICKET_LINKS = 10
export const liveColumns = (columns) => columns.filter((c) => !c.archived).sort(byPosition)

// The PMS status a column stands for (null when there is no column)
export function pmsStatusOfColumn(column, columns) {
  if (!column) return null
  if (column.isDone) return 'done'
  const first = liveColumns(columns).find((c) => !c.isDone)
  return first && first.id === column.id ? 'open' : 'progress'
}

// The column a PMS status goes to (null when the board has none that fits)
export function columnForPmsStatus(status, columns) {
  const live = liveColumns(columns)
  const work = live.filter((c) => !c.isDone)
  if (status === 'done') return live.find((c) => c.isDone) || null
  if (status === 'open') return work[0] || null
  if (status === 'progress') return work.find((c) => squash(c.name) === 'doing') || work[1] || work[0] || null
  return null
}
