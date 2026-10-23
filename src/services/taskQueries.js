// Read-only helpers meant to be used by the Widebed Dashboard (same Firebase project).
// They never write, and they keep task data separate from other business modules.
import { collection, getDocs, query, where, Timestamp } from '@/firebase/sdk'
import { db } from '@/firebase/config'

const tasksRef = collection(db, 'tasks')
const load = async (...c) => (await getDocs(query(tasksRef, ...c))).docs.map((d) => ({ id: d.id, ...d.data() }))

export const getEmployeeTasks = (uid) => load(where('assignedTo', 'array-contains', uid))
export const getDepartmentTasks = (departmentId) => load(where('departmentId', '==', departmentId))
export const getProjectTasks = (projectId) => load(where('projectId', '==', projectId))
export const getCompletedTasks = (departmentId) =>
  getDepartmentTasks(departmentId).then((t) => t.filter((x) => x.completedAt))
export const getOverdueTasks = (departmentId) =>
  getDepartmentTasks(departmentId).then((t) =>
    t.filter((x) => !x.completedAt && x.dueDate && x.dueDate.toMillis() < Timestamp.now().toMillis()))

// Completed / Total x 100. This is a statistic only, not a KPI score.
export const completionRate = (tasks) =>
  tasks.length ? Math.round((tasks.filter((t) => t.completedAt).length / tasks.length) * 100) : 0

export const projectProgress = (tasks) => completionRate(tasks)
