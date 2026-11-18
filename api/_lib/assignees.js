// Moved here from api/pms-task.js on 18 Nov 2026 (unchanged), so the Issues sync (api/_pms-issues.js) can use it too.
import { readPmsDoc, staffFrom, HttpError, deptForRole } from './pms.js'

// Each assignee needs a TMS profile so the board can show their name. Someone who has never signed in to the
// TMS gets a placeholder profile from their PMS staff record (every active PMS staff member can read staff records).
export async function ensureAssignees(db, FieldValue, me, uids) {
  const profiles = []
  for (const uid of uids) {
    const ref = db.collection('users').doc(uid)
    const snap = await ref.get()
    if (snap.exists) { profiles.push(snap.data()); continue }
    const fields = await readPmsDoc(`users/${uid}`, me.idToken)
    const s = fields && staffFrom(fields)
    if (!s || !s.active || !s.role) throw new HttpError(400, `Unknown or switched-off PMS staff: ${uid}`)
    const profile = { name: s.name || s.email || 'PMS staff', email: s.email, role: s.role === 'director' ? 'super_admin' : 'employee', departmentId: deptForRole(s.role), pmsRole: s.role, stub: true, createdAt: FieldValue.serverTimestamp() }
    await ref.set(profile)
    profiles.push(profile)
  }
  return profiles
}
