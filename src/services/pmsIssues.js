// Maintenance tickets: the TMS side of the PMS Issues link (docs/PMS_LINK.md, "Maintenance tickets").
//
// TMS -> PMS: a card of a ticket (task.pmsLink = { type: 'issue', id: 'IS-0001' }) that is moved, renamed or re-described
// here is written to the PMS ticket FIRST, as the signed-in person (their PMS sign-in, kept by this browser since login).
// The PMS rules decide: Directors and the roles tagged on the ticket may change it, and a Completed ticket is locked.
// If the PMS refuses, the TMS change is not made either, so both sides always agree.
//
// PMS -> TMS: the PMS calls /api/pms-task { action: 'issue' } after each change to a ticket (see api/_pms-issues.js).
//
// A task made on a Maintenance board is a new PMS ticket: the task form shows the PMS "Raise a ticket" fields
// (components/PmsTicketFields.vue), raiseInPms saves the ticket, then the server makes its task.
import { pmsAuth, pmsDb } from '@/firebase/config'
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, runTransaction, arrayUnion, serverTimestamp } from '@/firebase/sdk'
import { displayOf } from '@/utils/constants'
import {
  isIssueTask, pmsStatusOfColumn, PMS_TAG_FOR_ROLE, sameBoardName, BASE_TICKET_TAGS, ROLE_FOR_TAG,
  TICKET_TYPES, tagLabel, DRIVE_HOSTS, MAX_TICKET_LINKS,
} from '@/utils/issueStatus'

const STATUS_LABEL = { open: 'Open', progress: 'In progress', done: 'Completed', deleted: 'Deleted' }
const TYPE_NAME = Object.fromEntries(TICKET_TYPES.map((t) => [t.id, t.name]))
// The ticket's audit trail keeps local times as text, like the PMS Issues page (localIso there)
const pad = (n) => String(n).padStart(2, '0')
const nowIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

// How the person appears in the PMS: their PMS name and the tag their PMS role answers to
function who(profile) {
  const role = PMS_TAG_FOR_ROLE[profile?.pmsRole] || ''
  return { by: profile?.name || displayOf(profile), role, uid: pmsAuth.currentUser?.uid ?? '' }
}
function signedIn() {
  if (!pmsAuth.currentUser) throw new Error('Your PMS sign-in has ended. Sign out and sign in again.')
}
// A refusal from the PMS in plain words
function plainError(e, id) {
  if (e?.code === 'permission-denied') return new Error(`The PMS did not allow this change to ${id}: only Directors and the teams tagged on the ticket can change it`)
  if (e?.code === 'unavailable') return new Error('The PMS could not be reached. Check the connection and try again')
  return e instanceof Error ? e : new Error(String(e))
}

// ----- what the "Raise a ticket" form offers: units of the board's property, and the roles to tag -----
let unitCache = null // { at, units, properties }, 10 minutes, like the PMS Issues page
let roleCache = null
async function pmsUnits() {
  if (unitCache && Date.now() - unitCache.at < 600000) return unitCache
  const [ps, us] = await Promise.all([getDocs(collection(pmsDb, 'properties')), getDocs(collection(pmsDb, 'units'))])
  const properties = ps.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' }))
  const names = Object.fromEntries(properties.map((p) => [p.id, p.name]))
  const units = us.docs.map((d) => ({ id: d.id, unitCode: d.data().unitCode, propertyId: d.data().propertyId ?? null, propertyName: names[d.data().propertyId] || '', active: d.data().active }))
    .filter((u) => u.active !== false && u.unitCode).sort((a, b) => a.unitCode.localeCompare(b.unitCode))
  unitCache = { at: Date.now(), units, properties }
  return unitCache
}
// Roles made on the PMS Roles page (tagged by their name)
async function customRoles() {
  if (roleCache) return roleCache
  try {
    roleCache = (await getDocs(collection(pmsDb, 'roles'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.active && r.name)
  } catch { roleCache = [] }
  return roleCache
}
// For the form on a Maintenance board (each board is one property, named after it). property: the PMS property this
// board is for; units: its units; unitsReadable false = this person's PMS role cannot read units (they type the unit
// code instead, as in the PMS).
export async function ticketChoices(board, profile) {
  signedIn()
  let units = [], properties = [], unitsReadable = true
  try { ({ units, properties } = await pmsUnits()) } catch { unitsReadable = false }
  const found = properties.find((p) => p.id === board?.pmsPropertyId) || properties.find((p) => sameBoardName(p.name, board?.name)) || null
  const property = { id: found?.id ?? board?.pmsPropertyId ?? null, name: found?.name || board?.name || '' }
  const custom = await customRoles()
  return {
    property, propertyFound: !!found || !unitsReadable, unitsReadable,
    units: property.id ? units.filter((u) => u.propertyId === property.id) : [],
    tags: [...BASE_TICKET_TAGS, ...custom.map((r) => r.name).filter((n) => !BASE_TICKET_TAGS.includes(n))],
    myTag: who(profile).role, // the person's own role: always tagged, as in the PMS
  }
}

// A Drive link the PMS accepts, or an error message
export function checkDriveLink(name, url, links) {
  let u
  try { u = new URL(String(url).trim()) } catch { u = null }
  if (!u || u.protocol !== 'https:' || !DRIVE_HOSTS.includes(u.hostname)) return { error: 'Paste a Google Drive link, starting with https://drive.google.com/ or https://docs.google.com/.' }
  if (links.some((l) => l.url === u.href)) return { error: 'That link is already added.' }
  if (links.length >= MAX_TICKET_LINKS) return { error: `Up to ${MAX_TICKET_LINKS} links each time.` }
  return { link: { name: String(name).trim().slice(0, 80) || 'Drive link', url: u.href } }
}

// ----- PMS notifications, as the PMS Issues page sends them (best effort: a failure never undoes the ticket) -----
async function notifyTagged({ id, tags, raisedByUid }, title, message, profile) {
  try {
    const me = who(profile)
    const custom = await customRoles()
    const roles = [...new Set(tags.map((g) => ROLE_FOR_TAG[g] || custom.find((r) => r.name === g)?.id).filter(Boolean))]
    const base = { title: title.slice(0, 200), message: message.slice(0, 600), type: 'issue', link: `/Operations/issues?id=${id}`, refId: id, readBy: [], starredBy: [], createdByUid: me.uid, createdByName: me.by }
    const jobs = roles.map((recipientRole) => addDoc(collection(pmsDb, 'notifications'), { ...base, recipientUid: null, recipientRole, createdAt: serverTimestamp() }))
    if (raisedByUid && raisedByUid !== me.uid) jobs.push(addDoc(collection(pmsDb, 'notifications'), { ...base, recipientUid: raisedByUid, recipientRole: null, createdAt: serverTimestamp() }))
    ;(await Promise.allSettled(jobs)).forEach((r) => { if (r.status === 'rejected') console.warn('PMS notification failed:', r.reason) })
  } catch (e) { console.warn('PMS notification failed:', e) }
}

// ----- TMS -> PMS: a ticket card's change -----
// column/columns: the card's new column and its board's columns (status + the column's name, shown in the PMS)
// title/description: new text (null = unchanged)
// property: { name, id } when the card moved to another property's board (null = unchanged)
// quiet: only the column NAME changed (a renamed column): skipped without an error when the ticket is closed
export async function pushToPms(task, { column = null, columns = [], title = null, description = null, property = null, quiet = false } = {}, profile) {
  if (!isIssueTask(task)) return
  const id = task.pmsLink.id
  signedIn()
  const ref = doc(pmsDb, 'issues', id)
  let cur
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error(`${id} no longer exists in the PMS`)
    cur = snap.data()
  } catch (e) { throw plainError(e, id) }
  if (cur.status === 'deleted') { // its card should be gone: remove it now (the server checks the ticket itself)
    await syncIssue(id).catch((e) => console.warn(`Could not remove the card of deleted ticket ${id}:`, e.message))
    if (quiet) return
    throw new Error(`${id} was deleted in the PMS, so its card has been removed`)
  }
  if (cur.status === 'done') {
    if (quiet) return
    throw new Error(`${id} is Completed in the PMS and locked there, so this card can't change`)
  }

  const me = who(profile)
  const changes = {}
  const lines = []
  let newStatus = null
  if (column) {
    const status = pmsStatusOfColumn(column, columns)
    if (cur.tmsStatus?.name !== column.name || cur.tmsStatus?.for !== status) changes.tmsStatus = { name: column.name, for: status }
    if (status && status !== cur.status) {
      newStatus = status
      changes.status = status
      lines.push(`moved the card to ${column.name} in the task system, so the ticket is ${STATUS_LABEL[status]}`)
      if (status === 'done') Object.assign(changes, { doneAt: serverTimestamp(), doneBy: me.by, doneByUid: me.uid })
    }
  }
  const t = title?.trim().slice(0, 200)
  if (t && t !== cur.title) { changes.title = t; lines.push(`changed the title in the task system (was "${String(cur.title ?? '').slice(0, 80)}")`) }
  const d = description == null ? null : description.trim().slice(0, 5000)
  if (d != null && d !== (cur.body ?? '')) { changes.body = d; lines.push('changed the description in the task system') }
  if (property?.name && !sameBoardName(property.name, cur.property)) {
    Object.assign(changes, { property: property.name.slice(0, 80), propertyId: property.id || null })
    lines.push(`moved the card to the ${property.name} board in the task system (was ${cur.property || 'no property'})`)
  }
  if (!Object.keys(changes).length) return

  const entries = lines.map((text) => ({ at: nowIso(), by: me.by, role: me.role, text }))
  try {
    await updateDoc(ref, { ...changes, ...(entries.length ? { audit: arrayUnion(...entries) } : {}), updatedAt: serverTimestamp() })
  } catch (e) {
    if (quiet) { console.warn(`Could not update the column name on ${id}:`, e.message); return }
    throw plainError(e, id)
  }
  const tTitle = changes.title || cur.title
  if (newStatus === 'progress') notifyTagged({ id, ...cur }, `${id} is in progress`, `${me.by} marked "${tTitle}" in progress (task system: ${column.name}).`, profile)
  if (newStatus === 'done') notifyTagged({ id, ...cur }, `${id} completed`, `${me.by} marked "${tTitle}" completed (task system).`, profile)
}

// ----- a new ticket from a Maintenance board -----
// ticket = { type: 'customer' | 'inhouse', title, body, unit: a unit from ticketChoices | null (either type), unitText (typed
// code when units can't be read), tags: [tag], links: [{ name, url }] }; choices = ticketChoices(board).
// Saves it like "Raise a ticket" in the PMS, as this person (their own role is always tagged). Returns { id, tags }.
export async function raiseInPms(ticket, choices, profile) {
  signedIn()
  const me = who(profile)
  const tags = [...new Set([...(choices.tags || BASE_TICKET_TAGS)].filter((g) => ticket.tags.includes(g) || g === me.role))]
  // a unit may be given for either type (required for Customer, which the form checks)
  const unit = ticket.unit || null
  const code = unit?.unitCode || String(ticket.unitText ?? '').trim().toUpperCase()
  // every ticket has a property: the board's (the units offered are that property's)
  const property = unit ? { id: unit.propertyId, name: unit.propertyName } : choices.property
  const links = (ticket.links || []).slice(0, MAX_TICKET_LINKS)
  const audit = { at: nowIso(), by: me.by, role: me.role,
    text: `raised the ${TYPE_NAME[ticket.type]} ticket from the task system, tagged ${tags.map(tagLabel).join(', ')}` + (links.length ? ` · ${links.length} Drive link${links.length > 1 ? 's' : ''}` : '') }
  let id
  try {
    id = await runTransaction(pmsDb, async (tx) => {
      // the next IS number (counters/issues), the ticket and its first audit line, in one transaction
      const cRef = doc(pmsDb, 'counters', 'issues')
      const c = await tx.get(cRef)
      const n = c.exists() ? c.data().next || 1 : 1
      const newId = 'IS-' + String(n).padStart(4, '0')
      tx.set(cRef, { next: n + 1 })
      tx.set(doc(pmsDb, 'issues', newId), {
        type: ticket.type, title: ticket.title.trim().slice(0, 200), body: ticket.body.trim().slice(0, 5000),
        unit: code, unitId: unit?.id || null, property: property.name || '', propertyId: property.id || null, tags, status: 'open',
        raisedBy: me.by, raisedRole: me.role, raisedByUid: me.uid, links, linkCount: links.length, replyCount: 0, lastBy: me.by,
        audit: [audit], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      return newId
    })
  } catch (e) { throw plainError(e, 'the new ticket') }
  notifyTagged({ id, tags, raisedByUid: me.uid }, `New issue ${id}`, `${me.by} raised "${ticket.title.trim()}" from the task system, tagged ${tags.map(tagLabel).join(', ')}.`, profile)
  return { id, tags, propertyId: property.id || null }
}

// Asks the TMS server to make or update the ticket's task (it reads the ticket from the PMS itself).
// boardId: put a new task on this Maintenance board. Resolves { taskId, columnId, column, status, ... }.
export async function syncIssue(id, boardId = '') {
  signedIn()
  const token = await pmsAuth.currentUser.getIdToken()
  let r
  try {
    r = await fetch('/api/pms-task', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'issue', data: { id, ...(boardId ? { boardId } : {}) } }),
    })
  } catch { throw new Error('The task system server could not be reached') }
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `The task system server answered ${r.status}`)
  return body
}

// Cards of tickets that were deleted in the PMS (deleted before the link removed cards, or when that removal failed).
// Each card's ticket is read as this person; a deleted one's card is removed through the server, which reads the ticket
// itself. Tickets this person may not read are skipped. Resolves the IS numbers whose cards were removed.
export async function clearDeletedTickets(tasks) {
  if (!pmsAuth.currentUser) return []
  const linked = tasks.filter(isIssueTask)
  const removed = []
  for (let i = 0; i < linked.length; i += 10) { // ten at a time
    await Promise.all(linked.slice(i, i + 10).map(async (t) => {
      const id = t.pmsLink.id
      try {
        const snap = await getDoc(doc(pmsDb, 'issues', id))
        if (snap.exists() && snap.data().status === 'deleted' && (await syncIssue(id)).deleted) removed.push(id)
      } catch (e) { if (e?.code !== 'permission-denied') console.warn(`Could not check ${id} in the PMS:`, e.message) }
    }))
  }
  return removed
}
