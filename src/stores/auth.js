import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut,
} from '@/firebase/sdk'
import { auth, pmsAuth } from '@/firebase/config'
import { loadProfile } from '@/services/userService'
import { ROLES } from '@/utils/constants'

// Staff sign in with their Widebed PMS email and password (docs/PMS_LINK.md):
// PMS sign-in -> PMS ID token -> /api/pms-login -> TMS custom token (same uid) -> signed in here.
// Both sessions are remembered by the browser. The PMS one is re-checked on load and every half hour,
// so someone switched off in the PMS loses access here too.
const RECHECK_MS = 30 * 60 * 1000

const firstUser = (a) => new Promise((resolve) => { const stop = onAuthStateChanged(a, (u) => { stop(); resolve(u) }) })
const bridgeError = (code, message) => Object.assign(new Error(message), { code })

// Swaps a PMS login for a TMS custom token. bridge/refused = the PMS account is switched off or has no role.
async function bridge(pmsUser) {
  const idToken = await pmsUser.getIdToken()
  let r
  try {
    r = await fetch('/api/pms-login', {
      method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: '{}',
    })
  } catch { throw bridgeError('bridge/offline', 'The task system could not be reached') }
  const body = await r.json().catch(() => ({}))
  if (r.status === 401 || r.status === 403) throw bridgeError('bridge/refused', body.error || 'Access refused')
  if (!r.ok || !body.token) throw bridgeError('bridge/failed', body.error || 'Sign-in failed')
  return body.token
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null) // Firebase Auth user (TMS project)
  const profile = ref(null) // users/{uid} document
  let initPromise = null
  let timer = null

  const isAdmin = computed(() => profile.value?.role === ROLES.SUPER_ADMIN)
  const isManager = computed(() => profile.value?.role === ROLES.MANAGER)
  const canManage = computed(() => isAdmin.value || isManager.value)

  // Profile first, so pages never see a user without one
  async function setUser(u) {
    profile.value = u ? await loadProfile(u) : null
    user.value = u
  }

  // Resolves once both sign-ins are known and matched up (used by the router guard).
  function init() {
    initPromise ||= (async () => {
      const [p, t] = await Promise.all([firstUser(pmsAuth), firstUser(auth)])
      try {
        if (!p && t) await signOut(auth) // an old TMS-only session: sign in again with the PMS account
        else if (p && (!t || t.uid !== p.uid)) await signInWithCustomToken(auth, await bridge(p))
      } catch (e) {
        if (e.code === 'bridge/refused') await logout()
        else console.warn('PMS sign-in check failed:', e.message)
      }
      await new Promise((resolve) => onAuthStateChanged(auth, async (u) => { await setUser(u); resolve() }))
      if (p && user.value && t?.uid === p.uid) recheck() // already signed in: check the PMS account in the background
      timer ||= setInterval(recheck, RECHECK_MS)
    })()
    return initPromise
  }

  // Still allowed in the PMS? Signs out only on a clear refusal, not when offline.
  async function recheck() {
    const p = pmsAuth.currentUser
    if (!p || !auth.currentUser) return
    try {
      const token = await bridge(p)
      if (auth.currentUser?.uid !== p.uid) await setUser((await signInWithCustomToken(auth, token)).user)
    } catch (e) {
      if (e.code === 'bridge/refused') await logout()
    }
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(pmsAuth, email, password)
    try {
      const signedIn = await signInWithCustomToken(auth, await bridge(cred.user))
      await setUser(signedIn.user)
    } catch (e) {
      await signOut(pmsAuth)
      throw e
    }
  }
  const logout = () => Promise.all([signOut(auth), signOut(pmsAuth)])

  return { user, profile, isAdmin, isManager, canManage, init, login, logout }
})
