import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import router from '@/router'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { useDashboardStore } from './dashboard'
import { resolveTheme, applyTheme, dashboardLayer } from '@/utils/themes'
import { subscribeAppearance, saveAppearance, backgroundUrl } from '@/services/themeService'

export const useThemeStore = defineStore('theme', () => {
  const auth = useAuthStore()
  const ui = useUiStore()
  const dash = useDashboardStore()

  const globalLayer = ref({}) // applies everywhere
  const pages = ref({}) // { [routeName]: layer } applies to one page
  const bgUrl = ref('')
  let unsub = null

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(media.matches)
  media.addEventListener('change', (e) => (systemDark.value = e.matches))

  // Precedence: page layer beats dashboard layer beats global layer.
  const route = router.currentRoute
  const dashLayer = computed(() => (route.value.name === 'dashboard' && dash.active ? dashboardLayer(dash.active) : null))
  const pageLayer = computed(() => pages.value[route.value.name] ?? null)
  const effective = computed(() => resolveTheme([globalLayer.value, dashLayer.value, pageLayer.value], systemDark.value))

  watch(effective, (t) => { applyTheme(t); ui.dark = t.mode === 'dark' }, { immediate: true, deep: true })
  watch(() => effective.value.background, async (bg) => { bgUrl.value = await backgroundUrl(bg) }, { immediate: true, deep: true })

  function start() {
    stop()
    unsub = subscribeAppearance(auth.user.uid, (data) => {
      globalLayer.value = data.global ?? {}
      pages.value = data.pages ?? {}
    }, (e) => console.error('Could not load appearance settings', e))
  }
  function stop() {
    unsub?.(); unsub = null
    globalLayer.value = {}; pages.value = {}
  }

  async function persist() {
    try {
      await saveAppearance(auth.user.uid, { global: globalLayer.value, pages: pages.value })
      return true
    } catch (e) {
      console.error(e)
      ui.toast(`Could not save your appearance settings: ${e.code ?? e.message}`, 'error')
      return false
    }
  }
  const saveGlobal = (layer) => { globalLayer.value = layer; return persist() }
  const savePage = (key, layer) => {
    const next = { ...pages.value }
    if (Object.keys(layer).length) next[key] = layer; else delete next[key]
    pages.value = next
    return persist()
  }

  // The sun/moon button in the top bar
  function toggleDark() {
    if (dashLayer.value?.preset || pageLayer.value?.preset) {
      ui.toast('This page has its own theme. Change it under Appearance & Theme.', 'error'); return
    }
    const next = effective.value.mode === 'dark' ? 'light' : 'dark'
    saveGlobal({ ...globalLayer.value, preset: next, colors: undefined })
  }

  return { globalLayer, pages, bgUrl, systemDark, effective, start, stop, saveGlobal, savePage, toggleDark }
})
