import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/firebase/sdk', () => ({ Timestamp: class {} }))
vi.mock('@/firebase/config', () => ({ db: {}, auth: {} }))
const { addAttachment } = vi.hoisted(() => ({ addAttachment: vi.fn(async () => ({})) }))
vi.mock('@/services/taskService', () => ({ addAttachment }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'me' }, profile: { id: 'me', displayName: 'Me' } }) }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LinkifiedText from '@/components/LinkifiedText.vue'
import DescriptionLinks from '@/components/DescriptionLinks.vue'

beforeEach(() => { setActivePinia(createPinia()); addAttachment.mockClear(); localStorage.clear(); vi.useRealTimers() })

describe('links in the description', () => {
  it('are blue, underlined, open in a new tab, and never run as markup', () => {
    const w = mount(LinkifiedText, { props: { text: 'read https://example.com/doc <b>x</b>' } })
    const a = w.get('a')
    expect(a.attributes('href')).toBe('https://example.com/doc')
    expect(a.attributes('target')).toBe('_blank'); expect(a.attributes('rel')).toContain('noopener')
    expect(a.classes()).toEqual(expect.arrayContaining(['text-blue-600', 'underline']))
    expect(w.find('b').exists()).toBe(false) // the <b> is shown as text
    expect(w.text()).toContain('<b>x</b>')
  })
  it('offer "Add to attachments", which adds the link', async () => {
    const w = mount(DescriptionLinks, { props: { taskId: 't1', text: 'see https://example.com/spec.pdf', attachments: [] } })
    await new Promise((r) => setTimeout(r, 600))
    await w.get('button.btn-primary').trigger('click')
    await flushPromises()
    expect(addAttachment).toHaveBeenCalledWith('t1', expect.objectContaining({ url: 'https://example.com/spec.pdf', kind: 'pdf', name: 'spec.pdf' }), expect.anything())
  })
  it('hide that link\'s button after "No thanks", and stay hidden next time', async () => {
    const props = { taskId: 't2', text: 'https://example.com/x', attachments: [] }
    const w = mount(DescriptionLinks, { props })
    await new Promise((r) => setTimeout(r, 600))
    await w.findAll('button').find((b) => b.text() === 'No thanks').trigger('click')
    expect(w.find('li').exists()).toBe(false)
    const again = mount(DescriptionLinks, { props }); await new Promise((r) => setTimeout(r, 600))
    expect(again.find('li').exists()).toBe(false)
  })
  it('offer nothing for a link that is already attached', async () => {
    const w = mount(DescriptionLinks, { props: { taskId: 't3', text: 'https://example.com/a', attachments: [{ id: '1', url: 'https://example.com/a' }] } })
    await new Promise((r) => setTimeout(r, 600))
    expect(w.find('li').exists()).toBe(false)
  })
})
