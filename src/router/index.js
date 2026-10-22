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
    // Director (super_admin) only: departments and roles of PMS staff (accounts themselves are made in the PMS)
    { path: '/staff', name: 'staff', component: () => import('@/views/StaffView.vue'), meta: { admin: true } },
    { path: '/settings/appearance', name: 'appearance', component: () => import('@/views/AppearanceView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  const signedIn = !!(auth.user && auth.profile) // a profile is made by the PMS sign-in (api/pms-login.js)
  if (!to.meta.public && !signedIn) return { name: 'login' }
  if (to.meta.public && signedIn) return { name: 'dashboard' }
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' }
})

export default router
