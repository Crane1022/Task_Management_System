import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '@/stores/ui'
import ToastHost from '@/components/ToastHost.vue'

describe('Toast messages', () => {
  it('appear just below the top bar, on the profile side, and never take clicks from the buttons under them', async () => {
    const pinia = createPinia(); setActivePinia(pinia)
    const ui = useUiStore()
    const w = mount(ToastHost, { global: { plugins: [pinia] } })
    ui.toast('Task saved'); ui.toast('Could not save', 'error')
    await w.vm.$nextTick()
    const box = w.find('[aria-live]')
    expect(box.classes()).toContain('right-4')
    expect(box.classes()).not.toContain('bottom-4')
    expect(box.attributes('style')).toMatch(/top: calc\(4rem/)
    const items = box.findAll('div')
    expect(items.map((d) => d.text())).toEqual(['Task saved', 'Could not save'])
    items.forEach((d) => expect(d.classes()).toContain('pointer-events-none'))
  })
})
