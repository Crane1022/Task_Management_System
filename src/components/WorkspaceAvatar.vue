<script setup>
import { computed } from 'vue'
import { columnColor } from '@/utils/constants'
const props = defineProps({ workspace: Object, size: { type: Number, default: 28 } })
const bg = computed(() => columnColor(props.workspace?.color) || columnColor('sage'))
const text = computed(() => props.workspace?.icon || (props.workspace?.name ?? '?').trim()[0]?.toUpperCase() || '?')
</script>

<template>
  <span class="grid shrink-0 place-items-center rounded-lg font-extrabold text-white" :style="{ width: size + 'px', height: size + 'px', background: bg, fontSize: size * 0.5 + 'px' }" aria-hidden="true">{{ text }}</span>
</template>
