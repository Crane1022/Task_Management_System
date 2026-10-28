// POST /api/workspace-backfill   Authorization: Bearer <TMS ID token of a Director>   ->   { ok, fixed }
// Older workspaces were made before Super Private existed and have no `superPrivate` field, so the Directors' list
// ("every workspace with superPrivate == false") cannot find them. This gives each of them superPrivate: false.
// It only fills a MISSING field: a workspace that already says true or false is never touched, and it is safe to repeat.
import { getServices, handle, HttpError } from './_lib/pms.js'

export default handle(async (req) => {
  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!idToken) throw new HttpError(401, 'Not signed in')
  const { db, tmsAuth } = getServices()
  let uid
  try { uid = (await tmsAuth.verifyIdToken(idToken)).uid } catch { throw new HttpError(401, 'Not signed in') }
  const me = await db.collection('users').doc(uid).get()
  if (!me.exists || me.data().role !== 'super_admin') throw new HttpError(403, 'Directors only')

  const snap = await db.collection('workspaces').get()
  const missing = snap.docs.filter((d) => typeof d.data().superPrivate !== 'boolean')
  for (let i = 0; i < missing.length; i += 400) {
    const batch = db.batch()
    missing.slice(i, i + 400).forEach((d) => batch.update(d.ref ?? db.collection('workspaces').doc(d.id), { superPrivate: false }))
    await batch.commit()
  }
  return { ok: true, fixed: missing.length }
})
