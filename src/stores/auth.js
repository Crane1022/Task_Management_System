import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from '@/firebase/sdk'
import { auth } from '@/firebase/config'
import { loadOrCreateProfile } from '@/services/userService'
import { ROLES } from '@/utils/constants'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null) // Firebase Auth user
  const profile = ref(null) // users/{uid} document
  let pendingSignup = null
  let initPromise = null

  const isAdmin = computed(() => profile.value?.role === ROLES.SUPER_ADMIN)
  const isManager = computed(() => profile.value?.role === ROLES.MANAGER)
  const canManage = computed(() => isAdmin.value || isManager.value)

  // Resolves once Firebase has told us whether someone is signed in (used by the router guard).
  function init() {
    if (!initPromise) {
      initPromise = new Promise((resolve) => {
        onAuthStateChanged(auth, async (u) => {
          user.value = u
          profile.value = u ? await loadOrCreateProfile(u, pendingSignup ?? {}) : null
          pendingSignup = null
          resolve()
        })
      })
    }
    return initPromise
  }

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const register = (name, departmentId, email, password) => {
    pendingSignup = { name, departmentId }
    return createUserWithEmailAndPassword(auth, email, password)
  }
  const logout = () => signOut(auth)

  return { user, profile, isAdmin, isManager, canManage, init, login, register, logout }
})
