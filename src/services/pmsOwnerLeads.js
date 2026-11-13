// Owner Leads: the TMS side of the PMS Owner Leads link (docs/PMS_LINK.md, "Owner Leads").
//
// TMS -> PMS: a card of the Owner Leads board that is linked to a PMS listing (task.pmsLink = { type: 'newOwnerListing',
// id: 'NL-0001' }) and is moved to another column, renamed, or has its description edited, is written to the PMS listing FIRST, as the signed-in
// person (their PMS sign-in, kept by this browser since login). The PMS rules decide who may (Directors and Procurement
// move a listing; only Directors reopen a Not proceeding one). If the PMS refuses, the card is not changed either.
// Cards not linked yet (status New, waiting for Start listing in the PMS) are TMS only: the PMS reads them itself.
//
// PMS -> TMS: the PMS calls /api/pms-task { action: 'moveOwnerLead' } (api/_pms-owner-leads.js) and polls 'ownerLeads'.
import { pmsAuth, pmsDb } from '@/firebase/config'
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, deleteField } from '@/firebase/sdk'
import { displayOf } from '@/utils/constants'
import { isLinkedLead, leadChanges } from '@/utils/ownerLeadStatus'

// The listing's history keeps local times as text, like the PMS (localIso there)
const pad = (n) => String(n).padStart(2, '0')
const nowIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
function plainError(e, id) {
  if (e?.code === 'permission-denied') return new Error(`The PMS did not allow this change to ${id}: only Directors and Procurement move listings, and only Directors reopen a Not proceeding one`)
  if (e?.code === 'unavailable') return new Error('The PMS could not be reached. Check the connection and try again')
  return e instanceof Error ? e : new Error(String(e))
}

// Is the card's listing gone from the PMS? (13 Nov 2026: a Director deleted it there, so the card may be deleted
// here too). Read as the signed-in person; any doubt (no PMS sign-in, not allowed, PMS down) counts as "still there".
export async function leadListingGone(task) {
  if (!isLinkedLead(task) || !pmsAuth.currentUser) return false
  try { return !(await getDoc(doc(pmsDb, 'newOwnerListings', task.pmsLink.id))).exists() } catch { return false }
}

// column/columns: the card's new column (null = not moving); title: the card's new title (null = unchanged);
// description: the card's new description (null = unchanged), written to the listing's Description
export async function pushLeadToPms(task, { column = null, title = null, description = null } = {}, profile) {
  if (!isLinkedLead(task)) return
  const id = task.pmsLink.id
  if (!pmsAuth.currentUser) throw new Error('Your PMS sign-in has ended. Sign out and sign in again.')
  const ref = doc(pmsDb, 'newOwnerListings', id)
  let cur
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error(`${id} no longer exists in the PMS`)
    cur = { id, ...snap.data() }
  } catch (e) { throw plainError(e, id) }

  const me = { by: profile?.name || displayOf(profile), uid: pmsAuth.currentUser.uid, isDirector: profile?.pmsRole === 'director' }
  const { changes, line } = leadChanges(cur, column, me, serverTimestamp(), deleteField())
  const lines = line ? [line] : []
  const t = title?.trim().slice(0, 200)
  if (t && t !== cur.tmsTitle) { changes.tmsTitle = t; lines.push(`Renamed the card in the task system to "${t}".`) }
  if (description !== null) {
    const desc = String(description).trim().slice(0, 5000)
    if (desc !== String(cur.description || '').trim()) { changes.description = desc; lines.push('Description changed in the task system.') }
  }
  if (!Object.keys(changes).length) return

  const entries = lines.map((text) => ({ at: nowIso(), by: me.by, text }))
  try {
    await updateDoc(ref, {
      ...changes, ...(entries.length ? { history: arrayUnion(...entries) } : {}),
      updatedAt: serverTimestamp(), updatedByUid: me.uid, updatedByName: me.by,
    })
  } catch (e) { throw plainError(e, id) }
}
