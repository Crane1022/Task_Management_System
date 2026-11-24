// Tracks whether a form has changed since it was opened, and stops people leaving by accident.
//
//   const form = reactive({ title: '', description: '' })
//   const guard = useUnsavedGuard(() => form)
//   guard.isDirty      -> true once anything differs from the starting values
//   guard.reset()      -> call after loading a task into the form, and after a successful save
//   await guard.canLeave() -> asks "Leave without saving?" only when there is something to lose
//
// While the form is dirty it also:
//   - warns before the browser tab is closed or refreshed (browser's own "Leave site?" box)
//   - asks before moving to another page in the app (only when used inside a routed page or a component under it)
import { ref, computed, watch, onBeforeUnmount, getCurrentInstance } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmLeave } from './useConfirm'

const snap = (v) => {
  try { return JSON.stringify(v, (k, x) => (typeof x === 'string' ? x.trim() : x)) } catch { return String(Math.random()) }
}

export function useUnsavedGuard(source, { enabled = () => true } = {}) {
  const start = ref(snap(source()))
  const current = ref(start.value)
  watch(source, (v) => { current.value = snap(v) }, { deep: true })

  const isDirty = computed(() => enabled() && current.value !== start.value)

  function reset() {
    start.value = snap(source())
    current.value = start.value
  }

  async function canLeave() {
    if (!isDirty.value) return true
    const ok = await confirmLeave()
    if (ok) reset()
    return ok
  }

  const onUnload = (e) => {
    if (!isDirty.value) return
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', onUnload)

  if (getCurrentInstance()) {
    onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload))
    try { onBeforeRouteLeave(() => canLeave()) } catch { /* not under a router view: skip */ }
  }

  return { isDirty, reset, canLeave }
}
