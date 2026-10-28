// POST /api/pms-login   Authorization: Bearer <PMS ID token>   ->   { ok, token }
// Staff sign in to the TMS with their PMS email and password. The login page signs in to the PMS project,
// sends the PMS ID token here, and gets back a TMS custom token for the same uid (signInWithCustomToken).
// Switched-off PMS accounts and accounts with no PMS role are refused.
import { getServices, handle, pmsUser, DEPT_FOR_PMS_ROLE } from './_lib/pms.js'

export default handle(async (req) => {
  const me = await pmsUser(req)
  const { db, tmsAuth, FieldValue } = getServices()

  // The TMS profile users/{uid}. Created here (the only place: browsers can't create profiles), never
  // overwriting the role a Director set on the Staff page. The department follows the PMS role.
  // A PMS Director is a Director here too (role super_admin: every function the same). They are demoted again only if the PMS
  // role stops being Director, so nobody keeps Director powers after the PMS takes them away.
  const ref = db.collection('users').doc(me.uid)
  const snap = await ref.get()
  const now = FieldValue.serverTimestamp()
  const departmentId = DEPT_FOR_PMS_ROLE[me.role] ?? null
  if (!snap.exists) {
    await ref.set({
      name: me.name, email: me.email, role: me.role === 'director' ? 'super_admin' : 'employee', departmentId, pmsRole: me.role,
      createdAt: now, lastLoginAt: now,
    })
  } else {
    const old = snap.data()
    const roleChange = me.role === 'director' ? { role: 'super_admin' } : old.pmsRole === 'director' && old.role === 'super_admin' ? { role: 'employee' } : {}
    await ref.update({ name: me.name || old.name || '', email: me.email, pmsRole: me.role, departmentId, ...roleChange, stub: FieldValue.delete(), lastLoginAt: now })
  }

  const token = await tmsAuth.createCustomToken(me.uid, { pmsRole: me.role })
  return { ok: true, token }
})
