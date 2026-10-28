import { describe, it, expect, vi } from 'vitest'
vi.mock('@/firebase/sdk', () => ({ Timestamp: class {} }))
vi.mock('@/components/CatPeek.vue', () => ({ default: { template: '<i />' } }))
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardWidget from '@/components/DashboardWidget.vue'

const stats = { counts: { total: 12, completed: 5, pending: 7, overdue: 2, dueToday: 1 }, rate: 42, byStatus: [], workload: [], byDepartment: [], dueSoon: [], overdueList: [] }
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, { path: '/list', component: { template: '<i/>' } }] })
const make = (props) => mount(DashboardWidget, { props: { stats, ...props }, global: { plugins: [router], stubs: { CatPeek: true } } })

describe('Dashboard number cards', () => {
  it('open the List with the card, and carry the dashboard filters', async () => {
    const w = make({ widget: { id: 'a', type: 'overdue', size: 's', title: 'Overdue' }, scope: { assignee: 'u1', department: 'finance', days: 30 } })
    const a = w.get('a')
    expect(a.attributes('href')).toBe('/list?show=overdue&assignee=u1&department=finance&days=30')
    expect(a.attributes('title')).toContain('2 tasks')
  })
  it('each stat card names its own list', () => {
    for (const type of ['total', 'completed', 'pending', 'overdue', 'dueToday'])
      expect(make({ widget: { id: type, type, size: 's', title: type } }).get('a').attributes('href')).toBe(`/list?show=${type}`)
  })
  it('are not links while the dashboard is being edited, and charts are not links', () => {
    expect(make({ widget: { id: 'a', type: 'total', size: 's', title: 'T' }, editing: true }).find('a').exists()).toBe(false)
    expect(make({ widget: { id: 'b', type: 'rate', size: 'm', title: 'R' } }).find('a').exists()).toBe(false)
  })
})
