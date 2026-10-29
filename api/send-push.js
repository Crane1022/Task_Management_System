// POST /api/send-push   Authorization: Bearer <TMS ID token>   body: { items: [{ uid, id }] }   ->   { ok, sent }
// The app calls this right after it saves a notification for someone else, so their computer shows a desktop pop-up.
// The caller only names notifications; the server reads them itself and sends ONLY if
//   - the notification really is addressed to someone other than the caller, and was written by the caller (byId),
//   - it is fresh (a few minutes old) and has not been pushed already.
// So this cannot be used to send arbitrary text to anybody.
import { getServices, handle, HttpError } from './_lib/pms.js'
import { pushToUser } from './_lib/push.js'

export const MAX_ITEMS = 25
const FRESH_MS = 5 * 60 * 1000

export default handle(async (req) => {
  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!idToken) throw new HttpError(401, 'Not signed in')
  const services = getServices()
  let me
  try { me = (await services.tmsAuth.verifyIdToken(idToken)).uid } catch { throw new HttpError(401, 'Not signed in') }
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_ITEMS) : []
  let sent = 0
  for (const it of items) {
    if (typeof it?.uid !== 'string' || typeof it?.id !== 'string' || it.uid === me || it.uid.includes('/') || it.id.includes('/')) continue
    const ref = services.db.collection('users').doc(it.uid).collection('notifications').doc(it.id)
    const snap = await ref.get()
    if (!snap.exists) continue
    const n = snap.data()
    const age = Date.now() - (n.createdAt?.toMillis?.() ?? 0)
    if (n.byId !== me || n.pushedAt || age < 0 || age > FRESH_MS) continue
    await ref.update({ pushedAt: services.FieldValue.serverTimestamp() }) // claim it first, so a repeat call can't send it twice
    sent += await pushToUser(services, it.uid, n)
  }
  return { ok: true, sent }
})
