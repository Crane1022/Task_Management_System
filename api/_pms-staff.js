// syncStaff (17 Nov 2026, Khairul): TMS profiles follow the PMS staff records without the person signing in here.
// Called by api/pms-task.js { action: 'syncStaff' }:
//   - by the PMS after a Director or HR saves someone on Staff accounts (src/pages/Settings/Staff.vue there): { uids: [uid] }
//   - by the TMS Staff page button "Update all from PMS" (Directors): { all: true }
// For each TMS profile it copies what sign-in copies (api/pms-login.js): name, email, PMS role, department, and Director
// status (a PMS Director is a Director here; someone who stops being one drops to Employee). Roles a Director set here
// (Department Manager / Employee) and the person's own display name are left alone.
// Switched off in the PMS (or no role, or a custom role switched off / removed there): the profile is marked
// pmsOff: true and their TMS sessions are ended (open tabs sign out, see src/stores/auth.js). Switched back on: cleared.
// People with no TMS profile yet are skipped (they get one at their first sign-in). PMS records the caller can't read
// are skipped too, so nothing changes on a guess.
import { getServices, readPmsDoc, staffFrom, pmsRoleInfo, deptForRole, isCustomRole, AI_ROLE, AI_DEPT_NAME, HttpError } from './_lib/pms.js'

const UID = /^[A-Za-z0-9_-]{1,128}$/
// PMS roles that edit staff records there
export const STAFF_SYNC_ROLES = ['director', 'hr']
const MAX_UIDS = 300

export async function syncStaff(me, data) {
  if (!STAFF_SYNC_ROLES.includes(me.role)) throw new HttpError(403, 'Only Directors and HR update staff from the PMS')
  const { db, tmsAuth, FieldValue } = getServices()
  let uids
  if (data.all === true) {
    if (me.role !== 'director') throw new HttpError(403, 'Only Directors update everyone from the PMS')
    uids = (await db.collection('users').get()).docs.map((d) => d.id)
  } else {
    uids = [...new Set(Array.isArray(data.uids) ? data.uids.map(String) : [])]
    if (!uids.length) throw new HttpError(400, 'uids: give at least one PMS uid')
  }
  if (uids.length > MAX_UIDS || uids.some((u) => !UID.test(u))) throw new HttpError(400, `uids must be up to ${MAX_UIDS} PMS uids`)

  const out = { ok: true, updated: 0, switchedOff: 0, unchanged: 0, skipped: 0 }
  const roles = {} // custom role id -> { name, active } | null
  const namedDepts = new Set()
  for (const uid of uids) {
    const ref = db.collection('users').doc(uid)
    const snap = await ref.get()
    if (!snap.exists) { out.skipped++; continue }
    const old = snap.data()
    const fields = await readPmsDoc(`users/${uid}`, me.idToken)
    if (!fields) { out.skipped++; continue }
    const s = staffFrom(fields)

    let allowed = s.active && !!s.role
    let roleName = null
    if (allowed && isCustomRole(s.role)) {
      if (!(s.role in roles)) roles[s.role] = await pmsRoleInfo(s.role, me.idToken)
      allowed = !!roles[s.role]?.active
      roleName = roles[s.role]?.name ?? null
    } else if (s.role === AI_ROLE) roleName = AI_DEPT_NAME

    if (!allowed) {
      if (old.pmsOff !== true) {
        await ref.update({ pmsOff: true, pmsOffAt: FieldValue.serverTimestamp() })
        out.switchedOff++
      } else out.unchanged++
      // end their TMS sessions (again is harmless)
      try { await tmsAuth.revokeRefreshTokens(uid) } catch (e) { console.error('Could not end TMS sessions', uid, e.message) }
      continue
    }

    const departmentId = deptForRole(s.role)
    if (roleName && departmentId && !namedDepts.has(departmentId)) {
      namedDepts.add(departmentId)
      await db.collection('departments').doc(departmentId).set({ name: roleName, pmsRole: s.role, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
    const roleChange = s.role === 'director' ? { role: 'super_admin' }
      : old.pmsRole === 'director' && old.role === 'super_admin' ? { role: 'employee' } : {}
    const want = { name: s.name || old.name || '', email: s.email || old.email || '', pmsRole: s.role, departmentId, ...roleChange }
    const changes = Object.fromEntries(Object.entries(want).filter(([k, v]) => (old[k] ?? null) !== (v ?? null)))
    if (old.pmsOff) { changes.pmsOff = FieldValue.delete(); changes.pmsOffAt = FieldValue.delete() }
    if (!Object.keys(changes).length) { out.unchanged++; continue }
    await ref.update(changes)
    out.updated++
  }
  return out
}
