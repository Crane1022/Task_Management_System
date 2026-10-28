// Everything a dashboard can show. A saved dashboard is just a list of { id, type, size, title }.
export const WIDGET_TYPES = [
  { type: 'total', title: 'Total tasks', hint: 'Every task in view', size: 's' },
  { type: 'completed', title: 'Completed', hint: 'Tasks that are done', size: 's' },
  { type: 'pending', title: 'Pending', hint: 'Tasks still open', size: 's' },
  { type: 'overdue', title: 'Overdue', hint: 'Open tasks past their deadline', size: 's' },
  { type: 'dueToday', title: 'Due today', hint: 'Open tasks due today', size: 's' },
  { type: 'rate', title: 'Completion rate', hint: 'Completed ÷ total', size: 'm' },
  { type: 'byStatus', title: 'Tasks by status', hint: 'One bar per board column', size: 'm' },
  { type: 'workload', title: 'Employee workload', hint: 'Open tasks per person', size: 'm' },
  { type: 'byDepartment', title: 'Department completion', hint: 'Completion rate per department', size: 'm' },
  { type: 'dueSoon', title: 'Due in the next 7 days', hint: 'Upcoming deadlines', size: 'm' },
  { type: 'overdueList', title: 'Overdue tasks', hint: 'Oldest deadlines first', size: 'm' },
]
export const STAT_TYPES = ['total', 'completed', 'pending', 'overdue', 'dueToday']

export const makeWidget = (type) => {
  const t = WIDGET_TYPES.find((w) => w.type === type)
  return { id: crypto.randomUUID(), type, size: t.size, title: t.title }
}
export const DEFAULT_WIDGETS = () =>
  ['total', 'completed', 'pending', 'overdue', 'rate', 'byStatus', 'workload', 'dueSoon'].map(makeWidget)

export const SIZE_CLASS = {
  s: 'md:col-span-3 lg:col-span-3',
  m: 'md:col-span-6 lg:col-span-6',
  l: 'md:col-span-6 lg:col-span-12',
}

export const PALETTES = [
  { id: 'moss', name: 'Moss', light: { accent: '#4f7a4a', soft: '#e3ecd8' }, dark: { accent: '#9cc783', soft: '#26331f' } },
  { id: 'clay', name: 'Clay', light: { accent: '#b0623a', soft: '#f3e1d3' }, dark: { accent: '#e4a27c', soft: '#3a2a21' } },
  { id: 'sky', name: 'Sky', light: { accent: '#3f7a96', soft: '#dcebf2' }, dark: { accent: '#8cc4dd', soft: '#1f3340' } },
  { id: 'blossom', name: 'Blossom', light: { accent: '#a8566f', soft: '#f4dde4' }, dark: { accent: '#e49bb2', soft: '#3a2530' } },
]
export const CATS = ['orange', 'gray', 'black', 'white', 'calico']
