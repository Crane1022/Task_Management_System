<script setup>
import { computed } from 'vue'
import { splitLinks } from '@/utils/links'

// Text where every web link is blue, underlined and clickable (opens in a new tab). Built with elements, never v-html,
// so nothing typed in a description can run as code.
const props = defineProps({ text: { type: String, default: '' } })
const parts = computed(() => splitLinks(props.text))
</script>

<template>
  <span class="whitespace-pre-wrap break-words"><template v-for="(p, i) in parts" :key="i"><a v-if="p.href" :href="p.href" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline decoration-blue-600/60 hover:decoration-blue-600 dark:text-blue-400" @click.stop>{{ p.text }}</a><template v-else>{{ p.text }}</template></template></span>
</template>
