<script setup>
import { ref } from 'vue'
// reasonLabel: also ask for a reason (required); it is passed to `confirm`
const props = defineProps({ title: String, message: String, confirmText: { type: String, default: 'Delete' }, reasonLabel: { type: String, default: '' } })
const emit = defineEmits(['confirm', 'cancel'])
const reason = ref('')
const error = ref('')
function confirm() {
  if (props.reasonLabel && !reason.value.trim()) { error.value = `${props.reasonLabel} is needed.`; return }
  if (props.reasonLabel) emit('confirm', reason.value.trim())
  else emit('confirm') // no argument, as before: some handlers take parameters of their own
}
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click.self="$emit('cancel')">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" role="alertdialog" aria-modal="true">
      <h3 class="text-base font-bold">{{ title }}</h3>
      <p class="mt-1 text-sm text-muted">{{ message }}</p>
      <div v-if="reasonLabel" class="mt-3">
        <label class="label" for="confirm-reason">{{ reasonLabel }} <span class="text-red-600">*</span></label>
        <textarea id="confirm-reason" v-model="reason" rows="2" maxlength="300" class="input" @input="error = ''" />
        <p v-if="error" class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" @click="$emit('cancel')">Cancel</button>
        <button class="btn-danger" @click="confirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>
