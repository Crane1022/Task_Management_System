<script setup>
import { ref, useAttrs } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

// A password box with an eye button that shows or hides what was typed. Hidden by default. Everything else (id,
// autocomplete, required, minlength, ...) goes to the real <input>, so forms and validation behave exactly as before.
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])
const attrs = useAttrs()
const shown = ref(false)
</script>

<template>
  <div class="relative">
    <input v-bind="attrs" :value="modelValue" :type="shown ? 'text' : 'password'" class="input pr-11" @input="$emit('update:modelValue', $event.target.value)" />
    <button
      type="button" class="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
      :aria-label="shown ? 'Hide password' : 'Show password'" :aria-pressed="shown" @click="shown = !shown"
    >
      <component :is="shown ? EyeOff : Eye" class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>
