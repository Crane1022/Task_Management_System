import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
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
    // Workspaces: each one holds boards. meta.tab picks the tab; meta.page is the key used for per-page themes.
    { path: '/workspaces/:wid', name: 'workspace', component: () => import('@/views/WorkspaceView.vue'), meta: { tab: 'boards', page: 'workspace' } },
    { path: '/workspaces/:wid/members', name: 'workspace-members', component: () => import('@/views/WorkspaceView.vue'), meta: { tab: 'members', page: 'workspace' } },
    { path: '/workspaces/:wid/settings', name: 'workspace-settings', component: () => import('@/views/WorkspaceView.vue'), meta: { tab: 'settings', page: 'workspace' } },
    // A specific board (the Kanban page then shows it; /board shows the board you opened last, "main" at first)
    { path: '/b/:bid', name: 'board-by-id', component: () => import('@/views/BoardView.vue'), meta: { tasks: true, page: 'board' } },
    // Director (super_admin) only: departments and roles of PMS staff (accounts themselves are made in the PMS)
    { path: '/staff', name: 'staff', component: () => import('@/views/StaffView.vue'), meta: { admin: true } },
    { path: '/settings/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/settings/appearance', name: 'appearance', component: () => import('@/views/AppearanceView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from) => {
  const auth = useAuthStore()
  await auth.init()
  const signedIn = !!(auth.user && auth.profile) // a profile is made by the PMS sign-in (api/pms-login.js)
  if (!to.meta.public && !signedIn) return { name: 'login' }
  if (to.meta.public && signedIn) return { name: 'dashboard' }
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' }
  // Opening the app (or signing in) lands on the page the person chose in their profile
  const landing = auth.profile?.landingPage
  if (to.name === 'dashboard' && (from === START_LOCATION || from.name === 'login') && landing && landing !== 'dashboard') return { name: landing }
})

export default router
