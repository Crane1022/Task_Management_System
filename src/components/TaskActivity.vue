<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeActivity } from '@/services/taskService'
import { ACTIVITY_LIMIT } from '@/utils/activity'
import { formatDateTime } from '@/utils/dates'

// What happened to the task, newest first. A task keeps only its latest 15 records (see docs/ENHANCEMENTS.md).
const props = defineProps({ taskId: String })
const items = ref([])
let unsub
onMounted(() => { unsub = subscribeActivity(props.taskId, (a) => (items.value = a)) })
onUnmounted(() => unsub?.())
</script>

<template>
  <section aria-label="Activity">
    <span class="label">Activity <span class="font-normal text-muted">(latest {{ ACTIVITY_LIMIT }})</span></span>
    <ul class="space-y-1.5 text-xs text-muted">
      <li v-for="a in items" :key="a.id"><b class="text-ink">{{ a.userName }}</b> {{ a.action }} {{ a.detail }} · {{ formatDateTime(a.createdAt) }}</li>
      <li v-if="!items.length">No activity yet.</li>
    </ul>
  </section>
</template>
