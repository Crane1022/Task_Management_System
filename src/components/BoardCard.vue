<script setup>
import { computed } from 'vue'
import { Star, Archive } from 'lucide-vue-next'
import { boardBgStyle } from '@/utils/boardBackground'
import { columnColor } from '@/utils/constants'
import { timeAgo } from '@/utils/boardStats'

// A compact preview of a board: background, a strip of its columns, and the task numbers.
const props = defineProps({ board: Object, workspaceName: String, preview: Object, starred: Boolean })
const emit = defineEmits(['open', 'star'])
const updated = computed(() => timeAgo(props.board.updatedAt?.toDate?.()))
</script>

<template>
  <article class="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-colors hover:border-highlight" tabindex="0" role="link"
    :aria-label="`Open board ${board.name}`" @click="emit('open')" @keydown.enter="emit('open')">
    <div class="relative h-24" :style="boardBgStyle(board.background)">
      <div v-if="preview?.columns.length" class="absolute inset-x-2 bottom-2 flex items-end gap-1" aria-hidden="true">
        <div v-for="c in preview.columns.slice(0, 6)" :key="c.id" class="min-w-0 flex-1 rounded-md bg-surface/85 p-1">
          <div class="h-1 rounded-full" :style="{ background: columnColor(c.color) || 'var(--accent)' }" />
          <p class="mt-0.5 truncate text-[9px] font-bold text-muted">{{ c.name }}</p>
          <div class="mt-0.5 flex gap-0.5"><span v-for="n in Math.min(c.count, 4)" :key="n" class="h-1.5 flex-1 rounded-sm bg-line" /></div>
        </div>
      </div>
      <button class="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-muted hover:text-highlight" :class="starred && 'text-highlight'"
        :aria-label="starred ? `Unstar ${board.name}` : `Star ${board.name}`" :aria-pressed="starred" @click.stop="emit('star')">
        <Star class="h-4 w-4" :fill="starred ? 'currentColor' : 'none'" />
      </button>
      <span v-if="board.archived" class="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-bold text-muted"><Archive class="h-3 w-3" />Archived</span>
    </div>
    <div class="p-3">
      <h3 class="truncate text-sm font-extrabold">{{ board.name }}</h3>
      <p class="truncate text-xs text-muted">{{ workspaceName }}</p>
      <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
        <span v-if="preview?.failed" class="rounded-md bg-bg px-1.5 py-0.5 text-muted">Counts unavailable</span>
        <template v-else-if="preview">
          <span class="rounded-md bg-bg px-1.5 py-0.5 text-muted">{{ preview.total }} tasks</span>
          <span class="rounded-md bg-accent-soft px-1.5 py-0.5 text-accent">{{ preview.done }} done</span>
          <span class="rounded-md px-1.5 py-0.5" :class="preview.overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-bg text-muted'">{{ preview.overdue }} overdue</span>
        </template>
        <span v-else class="skeleton h-5 w-40" />
      </div>
      <p class="mt-2 text-[11px] text-muted">Updated {{ updated }}</p>
    </div>
  </article>
</template>
