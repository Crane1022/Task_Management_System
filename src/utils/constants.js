export const DEPARTMENTS = [
  { id: 'management', name: 'Management' },
  { id: 'hr', name: 'HR' },
  { id: 'operation', name: 'Operation' },
  { id: 'finance', name: 'Finance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'it', name: 'IT' },
  { id: 'sales', name: 'Sales' },
  { id: 'procurement', name: 'Procurement' },
]

export const PRIORITIES = [
  { id: 'low', name: 'Low', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200' },
  { id: 'medium', name: 'Medium', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' },
  { id: 'high', name: 'High', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  { id: 'urgent', name: 'Urgent', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' },
]

export const ROLES = { SUPER_ADMIN: 'super_admin', MANAGER: 'dept_manager', EMPLOYEE: 'employee' }

export const BOARD_ID = 'main'
export const DEFAULT_PROJECT_ID = 'general'

export const DEFAULT_COLUMNS = ['NEW PROJECT', 'TODO', 'DOING', 'REVIEW', 'DONE']

export const deptName = (id) => (id ? DEPARTMENTS.find((d) => d.id === id)?.name ?? id : 'No department')
export const priorityOf = (id) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1]

export const COLUMN_COLORS = [
  { id: 'sage', name: 'Sage', hex: '#7fa36b' },
  { id: 'sky', name: 'Sky', hex: '#6fa8c7' },
  { id: 'honey', name: 'Honey', hex: '#d8a74a' },
  { id: 'clay', name: 'Clay', hex: '#c9734d' },
  { id: 'rose', name: 'Rose', hex: '#c9748d' },
  { id: 'plum', name: 'Plum', hex: '#9a7bbf' },
  { id: 'slate', name: 'Slate', hex: '#7d8b95' },
]
export const columnColor = (id) => COLUMN_COLORS.find((c) => c.id === id)?.hex ?? ''

// A person's name as shown in the app: the name they chose on their profile, else their PMS name
export const displayOf = (u) => u?.displayName || u?.name || 'Unknown'
export const initialsOf = (u) => displayOf(u).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

export const WORKSPACE_ICONS = ['🌿', '🏠', '🛠️', '📣', '💼', '🧾', '👥', '🔧', '🏗️', '📦', '💡', '🎯']
