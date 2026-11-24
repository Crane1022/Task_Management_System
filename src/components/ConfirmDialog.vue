<script setup>
import { ref } from 'vue'
// reasonLabel: also ask for a reason (required); it is passed to `confirm`
// onConfirm: the @confirm handler. It is taken as a function (24 Nov 2026) so the dialog can wait for it: while
// it runs, the confirm button shows a spinner and can't be pressed twice. Handlers that don't return a promise
// behave exactly as before.
const props = defineProps({ title: String, message: String, confirmText: { type: String, default: 'Delete' }, cancelText: { type: String, default: 'Cancel' }, reasonLabel: { type: String, default: '' }, onConfirm: Function })
const emit = defineEmits(['cancel'])
const reason = ref('')
const error = ref('')
const busy = ref(false)
async function confirm() {
  if (busy.value) return
  if (props.reasonLabel && !reason.value.trim()) { error.value = `${props.reasonLabel} is needed.`; return }
  // no argument without a reason, as before: some handlers take parameters of their own
  busy.value = true
  try { await (props.reasonLabel ? props.onConfirm?.(reason.value.trim()) : props.onConfirm?.()) }
  catch (e) { console.error(e) } finally { busy.value = false }
}
const cancel = () => { if (!busy.value) emit('cancel') }
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click.self="cancel">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" role="alertdialog" aria-modal="true">
      <h3 class="text-base font-bold">{{ title }}</h3>
      <p class="mt-1 text-sm text-muted">{{ message }}</p>
      <div v-if="reasonLabel" class="mt-3">
        <label class="label" for="confirm-reason">{{ reasonLabel }} <span class="text-red-600">*</span></label>
        <textarea id="confirm-reason" v-model="reason" :disabled="busy" rows="2" maxlength="300" class="input" @input="error = ''" />
        <p v-if="error" class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" :disabled="busy" @click="cancel">{{ cancelText }}</button>
        <button v-busy="busy" class="btn-danger" @click="confirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>
