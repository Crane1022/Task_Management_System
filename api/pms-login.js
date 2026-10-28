// POST /api/pms-login   Authorization: Bearer <PMS ID token>   ->   { ok, token }
// Staff sign in to the TMS with their PMS email and password. The login page signs in to the PMS project,
// sends the PMS ID token here, and gets back a TMS custom token for the same uid (signInWithCustomToken).
// Switched-off PMS accounts and accounts with no PMS role are refused.
import { getServices, handle, pmsUser, DEPT_FOR_PMS_ROLE } from './_lib/pms.js'

export default handle(async (req) => {
  const me = await pmsUser(req)
  const { db, tmsAuth, FieldValue } = getServices()

  // The TMS profile users/{uid}. Created here (the only place: browsers can't create profiles), never
  // overwriting role, which a Director sets on the Staff page. The department follows the PMS role.
  const ref = db.collection('users').doc(me.uid)
  const snap = await ref.get()
  const now = FieldValue.serverTimestamp()
  const departmentId = DEPT_FOR_PMS_ROLE[me.role] ?? null
  if (!snap.exists) {
    await ref.set({
      name: me.name, email: me.email, role: 'employee', departmentId, pmsRole: me.role,
      createdAt: now, lastLoginAt: now,
    })
  } else {
    await ref.update({ name: me.name || snap.data().name || '', email: me.email, pmsRole: me.role, departmentId, stub: FieldValue.delete(), lastLoginAt: now })
  }

  const token = await tmsAuth.createCustomToken(me.uid, { pmsRole: me.role })
  return { ok: true, token }
})
