<script setup>
import { Plus } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useUiStore } from '@/stores/ui'

// The task control of a page: New task. (The top bar is the same on every page, with only dark mode and profile.)
const board = useBoardStore()
const ui = useUiStore()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button v-if="board.canEdit" class="btn-primary" @click="ui.requestNewTask()"><Plus class="h-4 w-4" /><span class="hidden sm:inline">New task</span><span class="sm:hidden">New</span></button>
  </div>
</template>
