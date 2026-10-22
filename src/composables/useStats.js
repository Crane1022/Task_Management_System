import { computed } from 'vue'
import { dueState, startOfToday } from '@/utils/dates'
import { DEPARTMENTS } from '@/utils/constants'

// All dashboard numbers come from the same tasks the Kanban board uses.
// `scope` = { assignee, department, days } chosen on the dashboard.
export function useStats(board, scope) {
  const tasks = computed(() => {
    const cutoff = scope.days ? Date.now() - scope.days * 86400000 : 0
    return board.tasks.filter((t) =>
      (!scope.assignee || t.assignedTo?.includes(scope.assignee)) &&
      (!scope.department || t.departmentId === scope.department) &&
      (!cutoff || (t.createdAt?.toMillis?.() ?? Date.now()) >= cutoff))
  })
  const open = computed(() => tasks.value.filter((t) => !t.completedAt))

  const counts = computed(() => ({
    total: tasks.value.length,
    completed: tasks.value.length - open.value.length,
    pending: open.value.length,
    overdue: open.value.filter((t) => dueState(t) === 'overdue').length,
    dueToday: open.value.filter((t) => dueState(t) === 'today').length,
  }))
  // Completed / Total x 100 (a statistic, not a KPI score)
  const rate = computed(() => (counts.value.total ? Math.round((counts.value.completed / counts.value.total) * 100) : 0))

  const byStatus = computed(() => board.columns.map((c) => ({ label: c.name, value: tasks.value.filter((t) => t.columnId === c.id).length })))
  const workload = computed(() =>
    Object.values(board.users)
      .map((u) => ({ label: u.name, value: open.value.filter((t) => t.assignedTo?.includes(u.id)).length }))
      .filter((r) => r.value).sort((a, b) => b.value - a.value).slice(0, 8))
  const byDepartment = computed(() =>
    DEPARTMENTS.map((d) => {
      const list = tasks.value.filter((t) => t.departmentId === d.id)
      const done = list.filter((t) => t.completedAt).length
      return { label: d.name, total: list.length, value: list.length ? Math.round((done / list.length) * 100) : 0 }
    }).filter((r) => r.total))

  const byDue = (a, b) => a.dueDate.toMillis() - b.dueDate.toMillis()
  const dueSoon = computed(() => {
    const today = startOfToday()
    const end = new Date(today); end.setDate(end.getDate() + 7)
    return open.value.filter((t) => { const d = t.dueDate?.toDate?.(); return d && d >= today && d <= end }).sort(byDue).slice(0, 8)
  })
  const overdueList = computed(() => open.value.filter((t) => dueState(t) === 'overdue').sort(byDue).slice(0, 8))

  return { counts, rate, byStatus, workload, byDepartment, dueSoon, overdueList }
}
