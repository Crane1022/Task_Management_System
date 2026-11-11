<script setup>
import { computed } from 'vue'
import { parseRich } from '@/utils/richText'

// A task description with its point form and bold shown (marks: **bold**, "- " bullets, "1. " numbered; see
// utils/richText.js), and web links blue and clickable. Built with elements, never v-html, so nothing typed can run as
// code. compact: one flowing text with "•" markers, for the card preview (which cuts it to two lines).
const props = defineProps({ text: { type: String, default: '' }, compact: Boolean })
const lines = computed(() => parseRich(props.text))
const linkClass = 'text-blue-600 underline decoration-blue-600/60 hover:decoration-blue-600 dark:text-blue-400'
</script>

<template>
  <span v-if="compact" class="whitespace-pre-wrap break-words"><template v-for="(l, i) in lines" :key="i"><template v-if="i">{{ '\n' }}</template><template v-if="l.marker">{{ l.marker + ' ' }}</template><template v-for="(p, j) in l.parts" :key="j"><a v-if="p.href" :href="p.href" target="_blank" rel="noopener noreferrer" :class="[linkClass, p.bold && 'font-bold']" @click.stop>{{ p.text }}</a><b v-else-if="p.bold" class="font-bold text-ink">{{ p.text }}</b><template v-else>{{ p.text }}</template></template></template></span>
  <div v-else class="space-y-0.5 break-words">
    <template v-for="(l, i) in lines" :key="i">
      <div v-if="l.kind === 'blank'" class="h-2" aria-hidden="true" />
      <div v-else-if="l.marker" class="flex gap-2" :style="{ paddingLeft: `${l.indent * 1.25}rem` }">
        <span class="w-5 shrink-0 select-none text-right text-muted" aria-hidden="true">{{ l.marker }}</span>
        <span class="min-w-0 whitespace-pre-wrap"><template v-for="(p, j) in l.parts" :key="j"><a v-if="p.href" :href="p.href" target="_blank" rel="noopener noreferrer" :class="[linkClass, p.bold && 'font-bold']" @click.stop>{{ p.text }}</a><b v-else-if="p.bold" class="font-bold">{{ p.text }}</b><template v-else>{{ p.text }}</template></template></span>
      </div>
      <p v-else class="whitespace-pre-wrap"><template v-for="(p, j) in l.parts" :key="j"><a v-if="p.href" :href="p.href" target="_blank" rel="noopener noreferrer" :class="[linkClass, p.bold && 'font-bold']" @click.stop>{{ p.text }}</a><b v-else-if="p.bold" class="font-bold">{{ p.text }}</b><template v-else>{{ p.text }}</template></template></p>
    </template>
  </div>
</template>
