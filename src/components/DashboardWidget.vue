<script setup>
import { computed } from 'vue'
import { ListTodo, CircleCheck, Hourglass, TriangleAlert, CalendarClock, X } from 'lucide-vue-next'
import CatPeek from './CatPeek.vue'
import { STAT_TYPES } from '@/utils/widgets'
import { formatDate } from '@/utils/dates'
import { deptName } from '@/utils/constants'

const props = defineProps({ widget: Object, stats: Object, editing: Boolean, cat: String, scope: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update', 'remove'])

const icons = { total: ListTodo, completed: CircleCheck, pending: Hourglass, overdue: TriangleAlert, dueToday: CalendarClock }
const isStat = computed(() => STAT_TYPES.includes(props.widget.type))
// A number card opens the List with exactly those tasks (same dashboard filters carried over)
const to = computed(() => !props.editing && isStat.value
  ? { path: '/list', query: { show: props.widget.type, ...(props.scope.assignee && { assignee: props.scope.assignee }), ...(props.scope.department && { department: props.scope.department }), ...(props.scope.days && { days: props.scope.days }) } }
  : null)
const isList = computed(() => ['dueSoon', 'overdueList'].includes(props.widget.type))

// Bar charts share one layout
const rows = computed(() => ({ byStatus: props.stats.byStatus, workload: props.stats.workload, byDepartment: props.stats.byDepartment })[props.widget.type] ?? [])
const maxValue = computed(() => (props.widget.type === 'byDepartment' ? 100 : Math.max(1, ...rows.value.map((r) => r.value))))
const suffix = computed(() => (props.widget.type === 'byDepartment' ? '%' : ''))
const items = computed(() => (props.widget.type === 'dueSoon' ? props.stats.dueSoon : props.stats.overdueList))

const C = 2 * Math.PI * 42 // ring circumference
</script>

<template>
  <component
    :is="to ? 'router-link' : 'article'" :to="to || undefined"
    class="relative flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card"
    :class="[editing && 'cursor-grab ring-2 ring-accent/30', to && 'cursor-pointer hover:-translate-y-0.5 hover:border-highlight hover:shadow-lg transition-[transform,box-shadow,border-color] duration-200']"
    :title="to ? `See these ${stats.counts[widget.type]} tasks in the list` : undefined"
  >
    <CatPeek v-if="cat && !editing" :variant="cat" />

    <header class="flex items-center gap-2">
      <input v-if="editing" :value="widget.title" class="input py-1 font-bold" aria-label="Widget title" @change="emit('update', { title: $event.target.value.trim() || widget.title })" />
      <h3 v-else class="truncate text-sm font-bold" :class="isStat && 'text-muted'">{{ widget.title }}</h3>
      <template v-if="editing">
        <div class="ml-auto flex shrink-0 overflow-hidden rounded-lg border border-line" role="group" aria-label="Widget size">
          <button v-for="s in ['s', 'm', 'l']" :key="s" type="button" class="px-2 py-1 text-xs font-bold uppercase"
            :class="widget.size === s ? 'bg-accent text-on-primary' : 'text-muted hover:bg-bg'" :aria-pressed="widget.size === s" @click="emit('update', { size: s })">{{ s }}</button>
        </div>
        <button type="button" class="rounded p-1 text-muted hover:bg-bg hover:text-red-600" aria-label="Remove widget" @click="emit('remove')"><X class="h-4 w-4" /></button>
      </template>
    </header>

    <div v-if="isStat" class="mt-3 flex items-center gap-3">
      <span class="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><component :is="icons[widget.type]" class="h-5 w-5" /></span>
      <span class="text-3xl font-extrabold" :class="widget.type === 'overdue' && stats.counts.overdue > 0 && 'text-red-600'">{{ stats.counts[widget.type] }}</span>
    </div>

    <div v-else-if="widget.type === 'rate'" class="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 100 100" class="h-24 w-24 shrink-0 -rotate-90" role="img" :aria-label="`Completion rate ${stats.rate} percent`">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="10" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - stats.rate / 100)" style="transition: stroke-dashoffset 0.6s" />
        <text x="50" y="50" text-anchor="middle" dominant-baseline="central" class="rotate-90 fill-current text-[22px] font-extrabold" style="transform-origin: 50px 50px">{{ stats.rate }}%</text>
      </svg>
      <p class="text-sm text-muted">{{ stats.counts.completed }} of {{ stats.counts.total }} tasks completed</p>
    </div>

    <ul v-else-if="rows.length" class="mt-3 space-y-2">
      <li v-for="r in rows" :key="r.label">
        <div class="flex justify-between text-xs font-semibold"><span class="truncate">{{ r.label }}</span><span class="text-muted">{{ r.value }}{{ suffix }}</span></div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-accent transition-all duration-500" :style="{ width: (r.value / maxValue) * 100 + '%' }" /></div>
      </li>
    </ul>

    <ul v-else-if="isList && items.length" class="mt-3 divide-y divide-line text-sm">
      <li v-for="t in items" :key="t.id" class="flex items-center justify-between gap-3 py-1.5">
        <span class="truncate font-semibold">{{ t.title }}</span>
        <span class="shrink-0 text-xs text-muted">{{ formatDate(t.dueDate) }} · {{ deptName(t.departmentId) }}</span>
      </li>
    </ul>

    <p v-else class="mt-3 text-sm text-muted">Nothing to show yet.</p>
  </component>
</template>
