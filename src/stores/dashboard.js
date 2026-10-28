import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { subscribeDashboards, createDashboard, saveDashboard, deleteDashboard } from '@/services/dashboardService'
import { DEFAULT_WIDGETS } from '@/utils/widgets'

export const useDashboardStore = defineStore('dashboards', () => {
  const auth = useAuthStore()
  const ui = useUiStore()
  const list = ref([])
  const activeId = ref('')
  const loading = ref(true)
  const error = ref('')
  let unsub = null
  let seeding = false

  const active = computed(() => list.value.find((d) => d.id === activeId.value) ?? list.value[0] ?? null)

  function start() {
    stop()
    loading.value = true
    error.value = ''
    unsub = subscribeDashboards(auth.user.uid, async (items) => {
      list.value = items
      if (items.length) { loading.value = false; return }
      // First visit: give the person a starter dashboard (guarded so it is only created once)
      if (seeding) return
      seeding = true
      try { await createDashboard(auth.user.uid, 'My dashboard', DEFAULT_WIDGETS()) }
      catch (e) { error.value = e.message; loading.value = false }
      finally { seeding = false }
    }, (e) => { error.value = e.message; loading.value = false })
  }
  function stop() { unsub?.(); unsub = null }

  async function run(fn, msg) {
    try { return await fn() } catch (e) { console.error(e); ui.toast(`${msg}: ${e.code ?? e.message}`, 'error') }
  }
  const select = (id) => (activeId.value = id)
  const save = (changes) => run(() => saveDashboard(active.value.id, changes), 'Could not save dashboard')
  // returns true when the write worked (the appearance editor needs to know)
  const saveFor = async (id, changes) => (await run(async () => { await saveDashboard(id, changes); return true }, 'Could not save dashboard')) === true
  const create = (name) => run(async () => {
    const r = await createDashboard(auth.user.uid, name, DEFAULT_WIDGETS())
    activeId.value = r.id
    ui.toast('Dashboard created')
  }, 'Could not create dashboard')
  const remove = (id) => run(async () => { await deleteDashboard(id); activeId.value = ''; ui.toast('Dashboard deleted') }, 'Could not delete dashboard')

  return { list, active, loading, error, start, stop, select, save, saveFor, create, remove }
})
