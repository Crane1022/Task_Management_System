import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Screen sizes (25 Nov 2026): phone < 640 px (bottom bar + slide-out menu), half screen 640–1023 px
// (the sidebar shrinks to icons), desktop from 1024 px (full sidebar).
const PHONE = '(max-width: 639px)'
const MID = '(min-width: 640px) and (max-width: 1023px)'
function media(query) {
  const m = window.matchMedia(query)
  const r = ref(m.matches)
  m.addEventListener?.('change', (e) => (r.value = e.matches))
  return r
}

export const useUiStore = defineStore('ui', () => {
  const dark = ref(document.documentElement.classList.contains('dark')) // kept in sync by the theme store
  const collapsed = ref(localStorage.getItem('wb-collapsed') === '1')
  const mobileNav = ref(false)
  const toasts = ref([])
  const isPhone = media(PHONE)
  const isMid = media(MID)
  const midOpen = ref(false) // on a half screen the person can open the full sidebar for a moment
  // true = the sidebar shows icons only (on a phone it is a slide-out menu and always shows labels)
  const rail = computed(() => (isMid.value ? !midOpen.value : collapsed.value))
  // The board the Kanban, List, My Tasks and Dashboard pages show. "main" is the original board.
  const activeBoardId = ref(localStorage.getItem('wb-active-board') || 'main')
  function setActiveBoard(id) {
    activeBoardId.value = id || 'main'
    localStorage.setItem('wb-active-board', activeBoardId.value)
  }
  const newTaskTick = ref(0) // the top bar (or the phone's + button) bumps this; the board opens the new-task form

  function toggleCollapsed() {
    if (isMid.value) { midOpen.value = !midOpen.value; return }
    collapsed.value = !collapsed.value
    localStorage.setItem('wb-collapsed', collapsed.value ? '1' : '0')
  }
  function toast(message, type = 'success') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3500)
  }
  const requestNewTask = () => newTaskTick.value++

  // ----- loading bar (25 Nov 2026): anything that saves, sends or loads can run through track() and the thin
  // bar at the top of the screen moves until it is done. Page changes (router) use it too.
  const pending = ref(0)
  async function track(fn) {
    pending.value++
    try { return await (typeof fn === 'function' ? fn() : fn) } finally { pending.value = Math.max(0, pending.value - 1) }
  }
  const busy = computed(() => pending.value > 0)
  const navigating = ref(false) // a page is opening (its code and first data load); set by the router

  return { activeBoardId, setActiveBoard, newTaskTick, requestNewTask, dark, collapsed, mobileNav, toasts, toggleCollapsed, toast, isPhone, isMid, midOpen, rail, pending, busy, track, navigating }
})
