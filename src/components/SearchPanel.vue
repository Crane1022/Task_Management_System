<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { CheckSquare, MessageSquare, FileText, Image as ImageIcon, Loader2 } from 'lucide-vue-next'
import UserAvatar from './UserAvatar.vue'
import { useBoardStore } from '@/stores/board'
import { searchAll, splitHits, snippet, MIN_COMMENT_SEARCH } from '@/utils/search'
import { displayOf } from '@/utils/constants'
import { formatDate } from '@/utils/dates'

// Search results under the search box (26 Nov 2026): tasks, comments and attached files, grouped, with the words
// that match highlighted. The board behind is filtered by the same words.
const props = defineProps({ query: String })
const emit = defineEmits(['picked'])
const board = useBoardStore()
const router = useRouter()

const tab = ref('all')
const found = computed(() => searchAll(board.tasks, board.commentIndex, props.query, 8, board.users))
const counts = computed(() => ({ all: found.value.people.length + found.value.tasks.length + found.value.comments.length + found.value.files.length, people: found.value.people.length, tasks: found.value.tasks.length, comments: found.value.comments.length, files: found.value.files.length }))
const show = (k) => (tab.value === 'all' || tab.value === k) && counts.value[k] > 0
const tabs = [['all', 'All'], ['people', 'People'], ['tasks', 'Tasks'], ['comments', 'Comments'], ['files', 'Files']]
const short = computed(() => props.query.trim().length < MIN_COMMENT_SEARCH)

function open(task) {
  emit('picked')
  router.push({ path: `/b/${task.boardId || 'main'}`, query: { task: task.id } })
}
const isImage = (a) => a.kind === 'image'
// "Crane (Neo Ka Hoong)" when the chosen name differs from the full name, so either one can be found and highlighted
const fullName = (u) => (u.displayName && u.name && u.displayName !== u.name ? `${u.displayName} (${u.name})` : displayOf(u))
// a person: show the tasks assigned to them on this board
function openPerson(u) {
  emit('picked')
  board.filters.assignee = u.id
}
</script>

<template>
  <div class="reveal absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:right-auto sm:w-[34rem]" role="region" aria-label="Search results">
    <div role="tablist" class="flex gap-1 overflow-x-auto border-b border-line px-2 no-scrollbar">
      <button v-for="[k, label] in tabs" :key="k" type="button" role="tab" :aria-selected="tab === k" class="relative flex h-11 shrink-0 items-center gap-1.5 px-2.5 text-sm font-extrabold" :class="tab === k ? 'text-ink' : 'text-muted'" @mousedown.prevent @click="tab = k">
        {{ label }}<span class="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px]" :class="tab === k ? 'bg-accent text-on-primary' : 'bg-bg text-muted'">{{ counts[k] }}</span>
        <span class="absolute inset-x-2 bottom-0 h-[3px] rounded-t transition-transform duration-300" :class="tab === k ? 'scale-x-100 bg-accent' : 'scale-x-0 bg-accent'" />
      </button>
    </div>
    <div class="max-h-[60vh] overflow-auto p-2">
      <Transition name="status-swap" mode="out-in">
      <div :key="tab">
        <template v-if="show('people')">
          <p class="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">People</p>
          <button v-for="(p, i) in found.people" :key="p.user.id" type="button" class="stagger-in flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-bg" :style="{ '--i': i }" @mousedown.prevent @click="openPerson(p.user)">
            <UserAvatar :user="p.user" :size="36" />
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-extrabold"><template v-for="(x, j) in splitHits(fullName(p.user), query)" :key="j"><mark v-if="x.hit" class="rounded bg-amber-200 px-px text-ink">{{ x.t }}</mark><template v-else>{{ x.t }}</template></template></span><span class="block truncate text-xs text-muted">{{ p.count === 1 ? '1 open task' : `${p.count} open tasks` }} here · show only theirs</span></span>
          </button>
        </template>
        <template v-if="show('tasks')">
          <p class="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Tasks</p>
          <button v-for="(t, i) in found.tasks" :key="t.id" type="button" class="stagger-in flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-bg" :style="{ '--i': i }" @mousedown.prevent @click="open(t)">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><CheckSquare class="h-[18px] w-[18px]" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-extrabold"><template v-for="(p, j) in splitHits(t.title, query)" :key="j"><mark v-if="p.hit" class="rounded bg-amber-200 px-px text-ink">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span><span class="block truncate text-xs text-muted">{{ board.columnNameOf(t) }}<template v-if="t.dueDate"> · due {{ formatDate(t.dueDate) }}</template></span></span>
          </button>
        </template>
        <template v-if="show('comments')">
          <p class="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Comments</p>
          <button v-for="(c, i) in found.comments" :key="c.comment.id" type="button" class="stagger-in flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-bg" :style="{ '--i': i }" @mousedown.prevent @click="open(c.task)">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200"><MessageSquare class="h-[18px] w-[18px]" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-xs font-bold text-muted"><span class="text-ink">{{ c.comment.userName || displayOf(board.users[c.comment.userId]) }}</span> on {{ c.task.title }}</span><span class="block text-sm leading-snug"><template v-for="(p, j) in splitHits(snippet(c.comment.text, query), query)" :key="j"><mark v-if="p.hit" class="rounded bg-amber-200 px-px text-ink">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span></span>
          </button>
        </template>
        <template v-if="show('files')">
          <p class="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Attachments</p>
          <button v-for="(f, i) in found.files" :key="f.task.id + f.file.id" type="button" class="stagger-in flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-bg" :style="{ '--i': i }" @mousedown.prevent @click="open(f.task)">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg" :class="isImage(f.file) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'"><component :is="isImage(f.file) ? ImageIcon : FileText" class="h-[18px] w-[18px]" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-extrabold"><template v-for="(p, j) in splitHits(f.file.name, query)" :key="j"><mark v-if="p.hit" class="rounded bg-amber-200 px-px text-ink">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span><span class="block truncate text-xs text-muted">on {{ f.task.title }}</span></span>
          </button>
        </template>
        <div v-if="!counts.all && !board.commentsLoading" class="px-3 py-8 text-center"><p class="font-extrabold">Nothing found for “{{ query }}”</p><p class="mt-1 text-sm text-muted">Try another word, or check the spelling.</p></div>
      </div>
      </Transition>
      <p v-if="board.commentsLoading" class="flex items-center gap-2 px-2 py-2 text-xs font-bold text-muted"><Loader2 class="h-3.5 w-3.5 animate-spin" />Looking through comments…</p>
      <p v-else-if="short" class="px-2 py-2 text-xs text-muted">Type at least {{ MIN_COMMENT_SEARCH }} letters to search comments too.</p>
    </div>
  </div>
</template>
