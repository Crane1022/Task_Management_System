<script setup>
import { ref, computed } from 'vue'
import { ImagePlus, Trash2, Ban, CornerLeftUp } from 'lucide-vue-next'
import { GALLERY, POSITION_NAMES } from '@/utils/backgrounds'
import { validateImage } from '@/services/themeService'

// modelValue is the background setting of the scope being edited:
//   undefined = inherit, {type:'none'}, {type:'gallery', id}, {type:'upload', imageId}
const props = defineProps({ modelValue: Object, uploadUrl: String, allowInherit: Boolean, busy: Boolean })
const emit = defineEmits(['update:modelValue', 'file', 'remove-upload'])

const error = ref('')
const input = ref(null)
const bg = computed(() => props.modelValue)
const hasImage = computed(() => bg.value && ['gallery', 'upload'].includes(bg.value.type))

const set = (patch) => emit('update:modelValue', { ...bg.value, ...patch })
const pick = (id) => emit('update:modelValue', { type: 'gallery', id, position: bg.value?.position ?? 'center', size: bg.value?.size ?? 'cover', overlay: bg.value?.overlay ?? 0.35 })

function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  error.value = validateImage(file)
  if (!error.value) emit('file', file)
}
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button v-if="allowInherit" type="button" class="tile" :class="!bg && 'tile-on'" @click="emit('update:modelValue', undefined)">
        <span class="grid h-14 place-items-center rounded-lg bg-bg text-muted"><CornerLeftUp class="h-5 w-5" /></span><span>Inherit</span>
      </button>
      <button type="button" class="tile" :class="bg?.type === 'none' && 'tile-on'" @click="emit('update:modelValue', { type: 'none' })">
        <span class="grid h-14 place-items-center rounded-lg bg-bg text-muted"><Ban class="h-5 w-5" /></span><span>No image</span>
      </button>
      <button v-for="g in GALLERY" :key="g.id" type="button" class="tile" :class="bg?.type === 'gallery' && bg.id === g.id && 'tile-on'" :aria-pressed="bg?.type === 'gallery' && bg.id === g.id" @click="pick(g.id)">
        <span class="block h-14 rounded-lg bg-cover bg-center" :style="{ backgroundImage: `url('${g.url}')` }" /><span>{{ g.name }}</span>
      </button>
    </div>

    <div class="mt-4 rounded-xl border border-dashed border-line p-3">
      <div class="flex flex-wrap items-center gap-3">
        <span v-if="bg?.type === 'upload' && uploadUrl" class="h-14 w-24 rounded-lg bg-cover bg-center" :style="{ backgroundImage: `url('${uploadUrl}')` }" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold">Your own image</p>
          <p class="text-xs text-muted">JPG, PNG or WebP, up to 5 MB. It is shrunk to fit and saved privately to your account.</p>
        </div>
        <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="onFile" />
        <button type="button" class="btn-ghost" :disabled="busy" @click="input.click()"><ImagePlus class="h-4 w-4" />{{ bg?.type === 'upload' ? 'Replace' : 'Upload' }}</button>
        <button v-if="bg?.type === 'upload'" type="button" class="btn-ghost text-red-600" :disabled="busy" @click="emit('remove-upload')"><Trash2 class="h-4 w-4" />Remove</button>
      </div>
      <p v-if="error" class="mt-2 text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
    </div>

    <div v-if="hasImage" class="mt-4 grid gap-3 sm:grid-cols-3">
      <div><label class="label" for="bg-pos">Position</label>
        <select id="bg-pos" class="input" :value="bg.position ?? 'center'" @change="set({ position: $event.target.value })"><option v-for="(n, k) in POSITION_NAMES" :key="k" :value="k">{{ n }}</option></select></div>
      <div><label class="label" for="bg-size">Scaling</label>
        <select id="bg-size" class="input" :value="bg.size ?? 'cover'" @change="set({ size: $event.target.value })"><option value="cover">Fill the screen</option><option value="contain">Fit inside</option><option value="tile">Repeat as tiles</option></select></div>
      <div><label class="label" for="bg-ov">Overlay: {{ Math.round((bg.overlay ?? 0.35) * 100) }}%</label>
        <input id="bg-ov" type="range" min="0" max="0.9" step="0.05" class="w-full accent-[var(--accent)]" :value="bg.overlay ?? 0.35" @input="set({ overlay: Number($event.target.value) })" /></div>
    </div>
  </div>
</template>

<style scoped>
.tile { @apply flex flex-col gap-1 rounded-xl border border-line bg-surface p-1.5 text-left text-[11px] font-bold text-muted hover:border-highlight; }
.tile-on { @apply border-accent text-ink ring-2 ring-accent; }
</style>
