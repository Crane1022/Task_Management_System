import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
vi.mock('@/stores/workspace', () => ({ useWorkspaceStore: () => ({ addWorkspace: vi.fn(async () => 'w1') }) }))
import Dialog from '@/components/CreateWorkspaceDialog.vue'

describe('Create workspace dialog', () => {
  it('is shown on the page itself (body), not inside the component or sidebar, and Escape closes it', async () => {
    const host = document.createElement('aside'); document.body.appendChild(host)
    const w = mount(Dialog, { attachTo: host })
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
    w.unmount()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
