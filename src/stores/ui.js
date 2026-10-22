import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const dark = ref(document.documentElement.classList.contains('dark')) // kept in sync by the theme store
  const collapsed = ref(localStorage.getItem('wb-collapsed') === '1')
  const mobileNav = ref(false)
  const toasts = ref([])
  const newTaskTick = ref(0) // the top bar bumps this; the board opens the new-task form

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
    localStorage.setItem('wb-collapsed', collapsed.value ? '1' : '0')
  }
  function toast(message, type = 'success') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3500)
  }
  const requestNewTask = () => newTaskTick.value++
  return { newTaskTick, requestNewTask, dark, collapsed, mobileNav, toasts, toggleCollapsed, toast }
})
