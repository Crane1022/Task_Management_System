import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordInput from '@/components/PasswordInput.vue'

describe('PasswordInput', () => {
  const make = () => mount(PasswordInput, { props: { modelValue: 'secret1' }, attrs: { id: 'pw', autocomplete: 'current-password', required: true } })

  it('is hidden by default and the eye is a type="button"', () => {
    const w = make()
    expect(w.get('input').attributes('type')).toBe('password')
    expect(w.get('button').attributes('type')).toBe('button')
    expect(w.get('button').attributes('aria-label')).toBe('Show password')
  })
  it('reveals on one click and hides again on the next', async () => {
    const w = make()
    await w.get('button').trigger('click')
    expect(w.get('input').attributes('type')).toBe('text')
    expect(w.get('button').attributes('aria-label')).toBe('Hide password')
    expect(w.get('button').attributes('aria-pressed')).toBe('true')
    await w.get('button').trigger('click')
    expect(w.get('input').attributes('type')).toBe('password')
  })
  it('passes id, autocomplete and required to the real input and emits typed text', async () => {
    const w = make()
    const i = w.get('input')
    expect(i.attributes('id')).toBe('pw')
    expect(i.attributes('autocomplete')).toBe('current-password')
    expect(i.attributes('required')).toBeDefined()
    await i.setValue('another')
    expect(w.emitted('update:modelValue')[0]).toEqual(['another'])
  })
  it('does not submit the surrounding form when the eye is clicked', async () => {
    let submitted = 0
    const w = mount({ components: { PasswordInput }, template: '<form @submit.prevent="n"><PasswordInput model-value="x" /></form>', methods: { n() { submitted++ } } })
    await w.get('button').trigger('click')
    expect(submitted).toBe(0)
  })
})
