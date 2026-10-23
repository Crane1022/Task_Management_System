import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import * as svc from '@/services/workspaceService'
import { leavesAnAdmin } from '@/utils/permissions'

// The workspaces this person belongs to (a Director sees all), the boards in them, and their starred boards.
export const useWorkspaceStore = defineStore('workspace', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const workspaces = ref([])
  const boards = ref({}) // workspaceId -> boards
  const stars = ref([])
  const loading = ref(true)
  const error = ref('')
  let unsubs = []
  const boardUnsubs = new Map()

  const canCreateWorkspace = computed(() => auth.isAdmin || auth.isManager)
  const allBoards = computed(() => Object.values(boards.value).flat())
  const workspaceById = (id) => workspaces.value.find((w) => w.id === id)
  const boardById = (id) => allBoards.value.find((b) => b.id === id)
  const isStarred = (bid) => stars.value.includes(bid)
  // this person's role in a workspace: 'admin' | 'member' | 'viewer' | 'none' (a Director counts as admin everywhere)
  const roleIn = (ws) => (auth.isAdmin ? 'admin' : ws?.members?.[auth.user?.uid] ?? 'none')

  function syncBoards(list) {
    const ids = new Set(list.map((w) => w.id))
    for (const [id, stop] of boardUnsubs) {
      if (!ids.has(id)) { stop(); boardUnsubs.delete(id); const next = { ...boards.value }; delete next[id]; boards.value = next }
    }
    for (const w of list) {
      if (!boardUnsubs.has(w.id)) {
        boardUnsubs.set(w.id, svc.subscribeBoards(w.id, (b) => (boards.value = { ...boards.value, [w.id]: b }), () => {}))
      }
    }
  }

  function start() {
    stop()
    loading.value = true; error.value = ''
    unsubs = [
      svc.subscribeWorkspaces({ uid: auth.user.uid, isAdmin: auth.isAdmin }, (list) => {
        workspaces.value = list; loading.value = false; syncBoards(list)
      }, (e) => { error.value = e.message; loading.value = false }),
      svc.subscribeStars(auth.user.uid, (ids) => (stars.value = ids)),
    ]
  }
  function stop() {
    unsubs.forEach((u) => u()); unsubs = []
    boardUnsubs.forEach((u) => u()); boardUnsubs.clear()
    workspaces.value = []; boards.value = {}; stars.value = []
  }

  async function run(fn, msg) {
    try { return await fn() } catch (e) { console.error(e); ui.toast(`${msg}: ${e.code ?? e.message}`, 'error') }
  }

  const addWorkspace = (data) => run(async () => {
    const id = await svc.createWorkspace(auth.user.uid, data)
    ui.toast('Workspace created')
    return id
  }, 'Could not create workspace')
  const saveWorkspace = (id, changes, message = 'Workspace saved') => run(async () => { await svc.updateWorkspace(id, changes); ui.toast(message); return true }, 'Could not save workspace')

  const addMembers = (ws, roles) => run(async () => { await svc.setMembers(ws.id, roles); ui.toast('Members updated'); return true }, 'Could not update members')
  const changeRole = (ws, uid, role) => {
    if (!leavesAnAdmin(ws.members, uid, role)) { ui.toast('A workspace needs at least one admin', 'error'); return }
    return run(async () => { await svc.setMembers(ws.id, { [uid]: role }); ui.toast('Role changed'); return true }, 'Could not change the role')
  }
  const kick = (ws, uid) => {
    if (!leavesAnAdmin(ws.members, uid, null)) { ui.toast('A workspace needs at least one admin', 'error'); return }
    return run(async () => { await svc.removeMember(ws.id, uid); ui.toast('Member removed'); return true }, 'Could not remove the member')
  }

  const addBoard = (wid, data) => run(async () => {
    const id = await svc.createBoard(auth.user.uid, wid, data)
    ui.toast('Board created')
    return id
  }, 'Could not create board')
  const saveBoard = (id, changes, message = 'Board saved') => run(async () => { await svc.updateBoard(id, changes); ui.toast(message); return true }, 'Could not save board')
  const setBoardRole = (bid, uid, role) => run(async () => { await svc.setBoardRole(bid, uid, role); return true }, 'Could not change the board role')
  const removeBoard = async (bid) => {
    try {
      await svc.deleteEmptyBoard(bid)
      ui.toast('Board deleted')
      return true
    } catch (e) {
      if (e.code === 'board/not-empty') ui.toast('This board still has tasks. Move or delete them first.', 'error')
      else { console.error(e); ui.toast(`Could not delete the board: ${e.code ?? e.message}`, 'error') }
      return false
    }
  }
  const adoptMain = (wid) => run(async () => { await svc.adoptMainBoard(auth.user.uid, wid); ui.toast('The Main board is now in this workspace'); return true }, 'Could not add the Main board')

  const toggleStar = (bid) => run(() => svc.setStar(auth.user.uid, bid, !isStarred(bid)), 'Could not update the star')

  return {
    workspaces, boards, stars, loading, error, canCreateWorkspace, allBoards,
    workspaceById, boardById, isStarred, roleIn,
    start, stop, addWorkspace, saveWorkspace, addMembers, changeRole, kick,
    addBoard, saveBoard, setBoardRole, removeBoard, adoptMain, toggleStar,
  }
})
