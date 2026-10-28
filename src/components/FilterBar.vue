<script setup>
import { computed } from 'vue'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { DEPARTMENTS, PRIORITIES, displayOf } from '@/utils/constants'

const props = defineProps({ mine: Boolean }) // on My Tasks the employee filter is fixed to "me"
const board = useBoardStore()
const auth = useAuthStore()
const people = computed(() => Object.values(board.users).sort((a, b) => a.name.localeCompare(b.name)))
const extra = computed(() => Object.entries(board.filters).filter(([k, v]) => v && !(props.mine && k === 'assignee')).length)
function clear() { board.clearFilters(); if (props.mine) board.filters.assignee = 'me' }
</script>

<template>
  <select v-if="!mine" v-model="board.filters.assignee" class="input w-40" aria-label="Filter by employee">
    <option value="">All employees</option><option value="me">Assigned to me</option>
    <option v-for="u in people" :key="u.id" :value="u.id">{{ displayOf(u) }}</option>
  </select>
  <select v-model="board.filters.priority" class="input w-36" aria-label="Filter by priority">
    <option value="">All priorities</option><option v-for="p in PRIORITIES" :key="p.id" :value="p.id">{{ p.name }}</option>
  </select>
  <select v-model="board.filters.deadline" class="input w-40" aria-label="Filter by deadline">
    <option value="">Any deadline</option><option value="overdue">Overdue</option><option value="today">Due today</option>
    <option value="week">Next 7 days</option><option value="none">No deadline</option>
  </select>
  <select v-model="board.filters.state" class="input w-36" aria-label="Filter by done or open">
    <option value="">All tasks</option><option value="open">Open (pending)</option><option value="done">Completed</option>
  </select>
  <select v-if="auth.isAdmin" v-model="board.filters.department" class="input w-40" aria-label="Filter by department">
    <option value="">All departments</option><option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option>
  </select>
  <span v-if="board.filters.createdDays" class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">Created in the last {{ board.filters.createdDays }} days</span>
  <button v-if="extra" class="text-sm font-semibold text-accent" @click="clear">Clear filters</button>
</template>
