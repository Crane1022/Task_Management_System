import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
    // meta.tasks = show the search box and "New task" button in the top bar
    { path: '/board', name: 'board', component: () => import('@/views/BoardView.vue'), meta: { tasks: true } },
    { path: '/my-tasks', name: 'my-tasks', component: () => import('@/views/BoardView.vue'), props: { mine: true }, meta: { tasks: true } },
    { path: '/list', name: 'list', component: () => import('@/views/ListView.vue'), meta: { tasks: true } },
    { path: '/settings/appearance', name: 'appearance', component: () => import('@/views/AppearanceView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (!to.meta.public && !auth.user) return { name: 'login' }
  if (to.meta.public && auth.user) return { name: 'dashboard' }
})

export default router
