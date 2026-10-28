// Who may do what on a board. These rules are enforced again, on the server, in firestore.rules.
export const WORKSPACE_ROLES = [
  { id: 'admin', name: 'Admin', hint: 'Manages the workspace, its members and boards' },
  { id: 'member', name: 'Member', hint: 'Creates and updates tasks' },
  { id: 'viewer', name: 'Viewer', hint: 'Can look, but not change anything' },
]
export const roleName = (id) => WORKSPACE_ROLES.find((r) => r.id === id)?.name ?? 'No access'

// The role a person has on a workspace board:
//   a Director is admin everywhere; a workspace admin is admin on every board of the workspace;
//   anyone else gets the board's own role for them (if an admin set one), else their workspace role.
export function effectiveBoardRole({ isDirector, workspaceRole, workspacePrivate = false, boardOverride }) {
  // a Super Private workspace is the one place a Director's job does not give access: only the owner and the people added
  // by the owner get in (firestore.rules enforces the same)
  if (isDirector && !workspacePrivate) return 'admin'
  if (!workspaceRole || workspaceRole === 'none') return 'none'
  if (workspaceRole === 'admin') return 'admin'
  return boardOverride ?? workspaceRole
}

// A board with no board document is the original department board (id "main"): it keeps its old rules.
// The role a person has in a workspace as a whole (a Director counts as admin, except in Super Private workspaces)
export const workspaceRoleFor = (workspace, uid, isDirector) =>
  (isDirector && !workspace?.superPrivate ? 'admin' : workspace?.members?.[uid] ?? 'none')

export const legacyBoardRole = ({ isDirector, canManage }) => (isDirector || canManage ? 'admin' : 'member')

export const canEdit = (role) => role === 'admin' || role === 'member'
export const canManage = (role) => role === 'admin'

// Every workspace must keep at least one admin
export function leavesAnAdmin(members, uid, newRole) {
  const next = { ...members }
  if (newRole) next[uid] = newRole; else delete next[uid]
  return Object.values(next).includes('admin')
}
