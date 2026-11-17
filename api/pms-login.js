// POST /api/pms-login   Authorization: Bearer <PMS ID token>   ->   { ok, token }
// Staff sign in to the TMS with their PMS email and password. The login page signs in to the PMS project,
// sends the PMS ID token here, and gets back a TMS custom token for the same uid (signInWithCustomToken).
// Switched-off PMS accounts and accounts with no PMS role are refused. Roles made on the PMS Roles page and the
// AI Agent sign in too (17 Nov 2026): each is its own department, named in departments/{roleId} (kept after the role
// is removed in the PMS, so old tasks still show its name).
import { getServices, handle, pmsUser, deptForRole } from './_lib/pms.js'

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
  const departmentId = deptForRole(me.role)
  // A department made from a PMS role: keep its name here (only this server writes departments/)
  if (me.roleName && departmentId) {
    await db.collection('departments').doc(departmentId).set({ name: me.roleName, pmsRole: me.role, updatedAt: now }, { merge: true })
  }
  if (!snap.exists) {
    await ref.set({
      name: me.name, email: me.email, role: me.role === 'director' ? 'super_admin' : 'employee', departmentId, pmsRole: me.role,
      createdAt: now, lastLoginAt: now,
    })
  } else {
    const old = snap.data()
    const roleChange = me.role === 'director' ? { role: 'super_admin' } : old.pmsRole === 'director' && old.role === 'super_admin' ? { role: 'employee' } : {}
    await ref.update({ name: me.name || old.name || '', email: me.email, pmsRole: me.role, departmentId, ...roleChange, stub: FieldValue.delete(), pmsOff: FieldValue.delete(), pmsOffAt: FieldValue.delete(), lastLoginAt: now })
  }

  const token = await tmsAuth.createCustomToken(me.uid, { pmsRole: me.role })
  return { ok: true, token }
})
