import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const store = reactive({ workspaces: [], layout: null, saveLayout: vi.fn(async () => true) })
vi.mock('@/stores/workspace', () => ({ useWorkspaceStore: () => store }))
import SidebarWorkspaces from '@/components/SidebarWorkspaces.vue'

const stubs = { 'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' }, WorkspaceAvatar: { template: '<i />' } }
const LONG = 'Operation and Maintenance Workspace for the Whole Company'
const names = (w) => w.findAll('.ws-row').map((r) => r.find('a').text())

describe('Sidebar workspaces', () => {
  beforeEach(() => {
    localStorage.clear(); store.saveLayout.mockClear()
    store.workspaces = [{ id: 'a', name: LONG }, { id: 'b', name: 'Finance' }, { id: 'c', name: 'HR' }]
    store.layout = null
  })

  it('lists the workspaces and cuts a long name short until its arrow is pressed', async () => {
    const w = mount(SidebarWorkspaces, { global: { stubs } })
    expect(names(w)).toEqual([LONG, 'Finance', 'HR'])
    const label = () => w.find('.ws-row a span.truncate, .ws-row a span.break-words')
    expect(label().classes()).toContain('truncate')
    await w.find('button[aria-expanded]').trigger('click')
    expect(label().classes()).toContain('break-words')
    expect(label().classes()).not.toContain('truncate')
    expect(w.find('.collapsible').classes()).toContain('open')
    expect(w.find('.collapsible').attributes('inert')).toBeUndefined()
    await w.find('button[aria-expanded]').trigger('click')
    expect(label().classes()).toContain('truncate')
    expect(w.find('.collapsible').classes()).not.toContain('open')
    expect(w.find('.collapsible').attributes('inert')).toBeDefined() // closed links cannot be tabbed to
  })

  it('shows saved folders with their workspaces and opens or closes them', async () => {
    store.layout = { order: ['f:x', 'w:c'], folders: { x: { name: 'Ops', wsIds: ['b', 'a'] } } }
    const w = mount(SidebarWorkspaces, { global: { stubs } })
    expect(w.text()).toContain('Ops')
    const box = () => w.find('.folder-list').element.closest('.collapsible')
    expect(w.find('.folder-list').text()).toContain('Finance')
    expect(box().classList.contains('open')).toBe(true)
    await w.find('button[aria-expanded][title="Ops"]').trigger('click')
    expect(box().classList.contains('open')).toBe(false)
  })

  it('creates, renames and deletes a folder and saves each change', async () => {
    const w = mount(SidebarWorkspaces, { global: { stubs } })
    w.vm.startNewFolder()
    await w.vm.$nextTick()
    await w.find('input[aria-label="New folder name"]').setValue('  Sales  ')
    await w.find('form').trigger('submit')
    expect(store.saveLayout).toHaveBeenCalledTimes(1)
    const first = store.saveLayout.mock.calls[0][0]
    expect(Object.values(first.folders)[0]).toEqual({ name: 'Sales', wsIds: [] })
    expect(first.order[0].startsWith('f:')).toBe(true)
    expect(w.text()).toContain('Sales')

    await w.find('button[aria-label="Rename folder Sales"]').trigger('click')
    await w.find('input[aria-label="Rename folder Sales"]').setValue('Sales team')
    await w.find('form').trigger('submit')
    expect(Object.values(store.saveLayout.mock.calls[1][0].folders)[0].name).toBe('Sales team')

    await w.find('button[aria-label="Delete folder Sales team"]').trigger('click')
    expect(store.saveLayout.mock.calls[2][0].folders).toEqual({})
    expect(w.text()).not.toContain('Sales team')
  })

  it('deleting a folder puts its workspaces back in the main list', async () => {
    store.layout = { order: ['f:x'], folders: { x: { name: 'Ops', wsIds: ['b'] } } }
    const w = mount(SidebarWorkspaces, { global: { stubs } })
    await w.find('button[aria-label="Delete folder Ops"]').trigger('click')
    const saved = store.saveLayout.mock.calls[0][0]
    expect(saved.folders).toEqual({})
    expect(saved.order).toContain('w:b')
  })
})
