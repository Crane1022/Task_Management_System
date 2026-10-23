<script setup>
import { ref, computed } from 'vue'

// Deleting a column never deletes tasks: with tasks inside, the person must pick where they go.
const props = defineProps({ column: Object, count: Number, targets: Array })
const emit = defineEmits(['confirm', 'cancel'])
const target = ref(props.targets[0]?.id ?? '')
const canConfirm = computed(() => props.count === 0 || !!target.value)
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click.self="emit('cancel')">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" role="alertdialog" aria-modal="true">
      <h3 class="text-base font-bold">Delete “{{ column.name }}”?</h3>
      <template v-if="count > 0">
        <p class="mt-1 text-sm text-muted">This column has {{ count }} task{{ count === 1 ? '' : 's' }}. They will not be deleted. Choose a column to move them to.</p>
        <label class="label mt-4" for="move-to">Move tasks to</label>
        <select id="move-to" v-model="target" class="input">
          <option v-for="c in targets" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <p v-if="!targets.length" class="mt-2 text-xs font-semibold text-red-600">There is no other column to move them to. Create one first.</p>
      </template>
      <p v-else class="mt-1 text-sm text-muted">This column is empty. This cannot be undone.</p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" @click="emit('cancel')">Cancel</button>
        <button class="btn-danger" :disabled="!canConfirm" @click="emit('confirm', target)">{{ count > 0 ? 'Move tasks and delete' : 'Delete' }}</button>
      </div>
    </div>
  </div>
</template>
