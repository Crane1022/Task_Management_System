<script setup>
import { COLUMN_COLORS } from '@/utils/constants'
import { GALLERY } from '@/utils/backgrounds'
import { boardBgStyle } from '@/utils/boardBackground'
// Picks a board's background: one of the colours or one of the built-in pictures
defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue'])
const isOn = (bg, v) => bg?.type === v.type && (v.type === 'color' ? bg.color === v.color : bg.id === v.id)
</script>

<template>
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Board background">
    <button v-for="c in COLUMN_COLORS" :key="c.id" type="button" class="h-9 w-14 rounded-lg border-2" :class="isOn(modelValue, { type: 'color', color: c.id }) ? 'border-ink' : 'border-transparent'"
      :style="boardBgStyle({ type: 'color', color: c.id })" :title="c.name" :aria-label="c.name" @click="emit('update:modelValue', { type: 'color', color: c.id })" />
    <button v-for="g in GALLERY" :key="g.id" type="button" class="h-9 w-14 rounded-lg border-2" :class="isOn(modelValue, { type: 'gallery', id: g.id }) ? 'border-ink' : 'border-transparent'"
      :style="boardBgStyle({ type: 'gallery', id: g.id })" :title="g.name" :aria-label="g.name" @click="emit('update:modelValue', { type: 'gallery', id: g.id })" />
  </div>
</template>
