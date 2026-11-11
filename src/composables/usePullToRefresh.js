import { ref, onMounted, onUnmounted } from 'vue'

// Pull down from the top of a scrolling area on a phone to reload it (11 Nov 2026).
//   const scroller = ref(null)
//   const { pull, busy } = usePullToRefresh(scroller, () => reload())
//   <div ref="scroller" class="overflow-y-auto"> <PullIndicator :pull="pull" :busy="busy" /> …
// Only touch screens; nothing happens with a mouse. A pull further than THRESHOLD px starts the reload.
const THRESHOLD = 64
const MAX = 96

export function usePullToRefresh(elRef, onRefresh) {
  const pull = ref(0)
  const busy = ref(false)
  let startY = null

  const start = (e) => {
    const el = elRef.value
    if (busy.value || !el || el.scrollTop > 0 || e.touches.length !== 1) { startY = null; return }
    startY = e.touches[0].clientY
  }
  const move = (e) => {
    if (startY === null) return
    const dy = e.touches[0].clientY - startY
    if (dy <= 0) { pull.value = 0; return }
    if (e.cancelable) e.preventDefault() // stop the page bouncing while we pull
    pull.value = Math.min(MAX, dy * 0.5) // a little resistance
  }
  const end = async () => {
    if (startY === null) return
    startY = null
    if (pull.value < THRESHOLD) { pull.value = 0; return }
    busy.value = true
    pull.value = 48
    try { await onRefresh() } finally {
      busy.value = false
      pull.value = 0
    }
  }

  onMounted(() => {
    const el = elRef.value
    if (!el) return
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
  })
  onUnmounted(() => {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('touchstart', start)
    el.removeEventListener('touchmove', move)
    el.removeEventListener('touchend', end)
    el.removeEventListener('touchcancel', end)
  })

  return { pull, busy, threshold: THRESHOLD }
}
