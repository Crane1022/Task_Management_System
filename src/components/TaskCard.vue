<script setup>
import { computed } from 'vue'
import { Paperclip, MessageSquare, CheckSquare, CalendarDays } from 'lucide-vue-next'
import { priorityOf, deptName } from '@/utils/constants'
import { formatDate, dueState } from '@/utils/dates'

const props = defineProps({ task: Object, users: Object })

const priority = computed(() => priorityOf(props.task.priority))
const due = computed(() => dueState(props.task))
const subs = computed(() => props.task.subtasks ?? [])
const subsDone = computed(() => subs.value.filter((s) => s.done).length)
const people = computed(() => (props.task.assignedTo ?? []).map((id) => props.users[id]).filter(Boolean))
const initials = (u) => u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const labelColor = (text) => `hsl(${[...text].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 45%)`
</script>

<template>
  <article class="cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-highlight">
    <div v-if="task.labels?.length" class="mb-2 flex flex-wrap gap-1">
      <span v-for="l in task.labels" :key="l" class="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" :style="{ background: labelColor(l) }">{{ l }}</span>
    </div>

    <h3 class="text-sm font-bold leading-snug">{{ task.title }}</h3>
    <p v-if="task.description" class="mt-1 line-clamp-2 text-xs text-muted">{{ task.description }}</p>

    <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      <span class="rounded-md px-1.5 py-0.5" :class="priority.cls">{{ priority.name }}</span>
      <span class="rounded-md bg-bg px-1.5 py-0.5 text-muted">{{ deptName(task.departmentId) }}</span>
      <span v-if="task.category" class="rounded-md bg-bg px-1.5 py-0.5 text-muted">{{ task.category }}</span>
    </div>

    <div v-if="subs.length" class="mt-2.5">
      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div class="h-full rounded-full bg-accent" :style="{ width: (subsDone / subs.length) * 100 + '%' }" />
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between text-xs text-muted">
      <div class="flex items-center gap-3">
        <span v-if="task.dueDate" class="flex items-center gap-1 font-semibold"
          :class="{ 'text-red-600': due === 'overdue', 'text-amber-600': due === 'today' }">
          <CalendarDays class="h-3.5 w-3.5" />{{ formatDate(task.dueDate) }}<template v-if="due === 'overdue'"> · Overdue</template>
        </span>
        <span v-if="subs.length" class="flex items-center gap-1"><CheckSquare class="h-3.5 w-3.5" />{{ subsDone }}/{{ subs.length }}</span>
        <span v-if="task.attachments?.length" class="flex items-center gap-1"><Paperclip class="h-3.5 w-3.5" />{{ task.attachments.length }}</span>
        <span v-if="task.commentCount" class="flex items-center gap-1"><MessageSquare class="h-3.5 w-3.5" />{{ task.commentCount }}</span>
      </div>
      <div class="flex -space-x-1.5">
        <span v-for="u in people.slice(0, 3)" :key="u.id" :title="u.name"
          class="grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-accent-soft text-[10px] font-bold text-accent">{{ initials(u) }}</span>
        <span v-if="people.length > 3" class="grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-bg text-[10px] font-bold">+{{ people.length - 3 }}</span>
      </div>
    </div>
  </article>
</template>
