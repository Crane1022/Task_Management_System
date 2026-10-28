<script setup>
import { displayOf, initialsOf } from '@/utils/constants'
// A person's photo, or their initials when they have none
defineProps({ user: Object, size: { type: Number, default: 28 } })
</script>

<template>
  <img v-if="user?.photo" :src="user.photo" :alt="displayOf(user)" :title="displayOf(user)" class="shrink-0 rounded-full object-cover" :style="{ width: size + 'px', height: size + 'px' }" />
  <span v-else :title="displayOf(user)" class="grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.38 + 'px' }">{{ initialsOf(user) }}</span>
</template>
