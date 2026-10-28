<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next'

// Crop, zoom and reposition a picture inside a square frame. Transparent pictures stay transparent
// (PNG and WebP keep their see-through areas; the grey chequer shows where they are).
const props = defineProps({ file: File, title: { type: String, default: 'Crop your picture' }, hint: { type: String, default: '' }, confirmText: { type: String, default: 'Use this picture' }, out: { type: Number, default: 256 } })
const emit = defineEmits(['done', 'cancel'])

const VIEW = 280
const canvas = ref(null)
const zoom = ref(1)
const ox = ref(0)
const oy = ref(0)
const error = ref('')
const busy = ref(false)
let bmp = null
const ready = ref(false)

const base = computed(() => (bmp ? Math.max(VIEW / bmp.width, VIEW / bmp.height) : 1)) // fills the frame at zoom 1
const clampOffsets = () => {
  if (!bmp) return
  const maxX = Math.max(0, (bmp.width * base.value * zoom.value - VIEW) / 2)
  const maxY = Math.max(0, (bmp.height * base.value * zoom.value - VIEW) / 2)
  ox.value = Math.min(maxX, Math.max(-maxX, ox.value))
  oy.value = Math.min(maxY, Math.max(-maxY, oy.value))
}
function paint(ctx, size) {
  const k = size / VIEW
  const w = bmp.width * base.value * zoom.value * k, h = bmp.height * base.value * zoom.value * k
  ctx.drawImage(bmp, (size - w) / 2 + ox.value * k, (size - h) / 2 + oy.value * k, w, h)
}
function draw() {
  const c = canvas.value
  if (!c || !bmp) return
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, VIEW, VIEW)
  paint(ctx, VIEW)
  // thirds guide
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1
  ctx.beginPath(); for (const t of [VIEW / 3, (VIEW * 2) / 3]) { ctx.moveTo(t, 0); ctx.lineTo(t, VIEW); ctx.moveTo(0, t); ctx.lineTo(VIEW, t) } ctx.stroke()
}

onMounted(async () => {
  try {
    bmp = await createImageBitmap(props.file)
    if (!bmp.width || !bmp.height) throw new Error('empty')
    ready.value = true
    draw()
  } catch {
    error.value = 'This picture could not be opened. It may be damaged. Please choose another one.'
  }
})
onBeforeUnmount(() => bmp?.close?.())

// dragging inside the frame
let drag = null
const down = (e) => { if (!ready.value) return; canvas.value.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, ox: ox.value, oy: oy.value } }
const move = (e) => { if (!drag) return; ox.value = drag.ox + e.clientX - drag.x; oy.value = drag.oy + e.clientY - drag.y; clampOffsets(); draw() }
const up = () => { drag = null }
const setZoom = (z) => { zoom.value = Math.min(4, Math.max(1, z)); clampOffsets(); draw() }
const wheel = (e) => setZoom(zoom.value + (e.deltaY < 0 ? 0.1 : -0.1))
const nudge = (e) => {
  const step = 8
  const m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
  if (m) { e.preventDefault(); ox.value += m[0]; oy.value += m[1]; clampOffsets(); draw() }
  else if (e.key === '+' || e.key === '=') setZoom(zoom.value + 0.1)
  else if (e.key === '-') setZoom(zoom.value - 0.1)
}
const reset = () => { zoom.value = 1; ox.value = 0; oy.value = 0; draw() }

// Keeps the saved picture small: WebP (it keeps transparency), smaller or lighter until it is under about 150 KB
async function done() {
  busy.value = true
  try {
    for (const size of [props.out, 192, 128]) {
      const c = document.createElement('canvas')
      c.width = c.height = size
      paint(c.getContext('2d'), size)
      for (const q of [0.9, 0.75, 0.6]) {
        const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q))
        if (blob && blob.size < 150 * 1024) { emit('done', blob); return }
      }
    }
    error.value = 'The picture is too detailed to save small enough. Try zooming in or choose a simpler picture.'
  } catch { error.value = 'Could not prepare the picture. Please try again.' } finally { busy.value = false }
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <div class="my-4 w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" :aria-label="title">
      <h2 class="text-base font-extrabold">{{ title }}</h2>
      <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>

      <p v-if="error" class="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">{{ error }}</p>
      <template v-else>
        <div class="mt-4 grid place-items-center">
          <canvas
            ref="canvas" :width="VIEW" :height="VIEW" tabindex="0" class="chequer touch-none rounded-xl border border-line outline-offset-2" :class="ready ? 'cursor-move' : 'opacity-50'"
            aria-label="Picture frame. Drag to move, use the arrow keys to move and plus or minus to zoom."
            @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel" @keydown="nudge"
          />
        </div>
        <div class="mt-3 flex items-center gap-2">
          <button type="button" class="btn-ghost px-2" aria-label="Zoom out" @click="setZoom(zoom - 0.2)"><ZoomOut class="h-4 w-4" /></button>
          <input type="range" min="1" max="4" step="0.05" :value="zoom" class="min-w-0 flex-1 accent-[var(--accent)]" aria-label="Zoom" :disabled="!ready" @input="setZoom(Number($event.target.value))" />
          <button type="button" class="btn-ghost px-2" aria-label="Zoom in" @click="setZoom(zoom + 0.2)"><ZoomIn class="h-4 w-4" /></button>
          <button type="button" class="btn-ghost px-2" aria-label="Reset the crop" title="Reset" @click="reset"><RotateCcw class="h-4 w-4" /></button>
        </div>
      </template>

      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('cancel')">Cancel</button>
        <button v-if="!error" type="button" class="btn-primary" :disabled="!ready || busy" @click="done">{{ busy ? 'Preparing…' : confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chequer { background-color: #fff; background-image: linear-gradient(45deg, #d8dcd9 25%, transparent 25%, transparent 75%, #d8dcd9 75%), linear-gradient(45deg, #d8dcd9 25%, transparent 25%, transparent 75%, #d8dcd9 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px; }
</style>
