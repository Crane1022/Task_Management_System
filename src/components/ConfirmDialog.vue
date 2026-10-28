<script setup>
defineProps({ title: String, message: String, confirmText: { type: String, default: 'Delete' } })
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click.self="$emit('cancel')">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" role="alertdialog" aria-modal="true">
      <h3 class="text-base font-bold">{{ title }}</h3>
      <p class="mt-1 text-sm text-muted">{{ message }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" @click="$emit('cancel')">Cancel</button>
        <button class="btn-danger" @click="$emit('confirm')">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>
