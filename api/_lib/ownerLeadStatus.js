// PMS Owner Leads <-> the TMS board "Owner Leads" (workspace "Business Development & Procurement"). Plain JS with no
// imports, so the /api functions and the web app (src/utils/ownerLeadStatus.js re-exports this file) use the same
// mapping. See docs/PMS_LINK.md, "Owner Leads".
//
// The board's columns are the lead statuses, matched by name (spaces and capitals ignored):
//   New -> 'new'   In Progress -> 'progress'   Signed -> 'signed'   Live -> 'live'   Cancelled -> 'cancelled'
// A card in any other column has status null. The PMS listing is newOwnerListings/{NL-000n}.

export const OWNER_LEADS_WORKSPACE = 'Business Development & Procurement'
export const OWNER_LEADS_BOARD = 'Owner Leads'
export const OWNER_LEAD_LINK_TYPE = 'newOwnerListing'
export const LEAD_STATUSES = ['new', 'progress', 'signed', 'live', 'cancelled']
export const LEAD_STATUS_LABEL = { new: 'New', progress: 'In progress', signed: 'Signed', live: 'Live', cancelled: 'Not proceeding' }

export const squashName = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
const STATUS_OF_NAME = { new: 'new', inprogress: 'progress', signed: 'signed', live: 'live', cancelled: 'cancelled', canceled: 'cancelled' }
export const leadStatusOfColumn = (c) => (c ? STATUS_OF_NAME[squashName(c.name)] ?? null : null)

export const isOwnerLeadsWorkspace = (w) => !!w && !w.archived && w.superPrivate !== true && squashName(w.name) === squashName(OWNER_LEADS_WORKSPACE)
export const isOwnerLeadsBoardDoc = (b) => !!b && !b.archived && squashName(b.name) === squashName(OWNER_LEADS_BOARD)
// A card linked to a PMS listing (NL-0001)
export const isLinkedLead = (t) => t?.pmsLink?.type === OWNER_LEAD_LINK_TYPE && /^NL-\d{4,}$/.test(t.pmsLink.id ?? '')

// ----- TMS -> PMS: what a card's move changes on the PMS listing (src/services/pmsOwnerLeads.js) -----
// Older listings say 'inProgress'
export const statusOf = (l) => (l.status === 'inProgress' || !l.status ? 'progress' : l.status)
const RANK = { progress: 0, signed: 1, live: 2 }

// The PMS listing changes for a card moving to `column`: { changes, line } (line null when the status stays). Pure (stamp/remove are serverTimestamp()/deleteField()), for the tests.
// cur: the listing as read from the PMS; me: { by, uid, isDirector }. Throws when the move is not allowed.
export function leadChanges(cur, column, me, stamp, remove) {
  const id = cur.id || 'the listing'
  const want = leadStatusOfColumn(column)
  const from = statusOf(cur)
  const changes = {}
  if (column && cur.tmsColumn !== column.name) changes.tmsColumn = column.name
  if (!want || want === from) return { changes, line: null }
  if (want === 'new') throw new Error(`${id} has been started in the PMS, so its card can't go back to New. Move it to Cancelled if the owner is not going ahead`)
  if (from === 'cancelled' && !me.isDirector) throw new Error(`${id} is Not proceeding in the PMS. Only a Director can reopen it`)

  changes.status = want
  if (want === 'cancelled') {
    Object.assign(changes, { prevStatus: from, cancelledAt: stamp, cancelledBy: me.by, cancelledByUid: me.uid, cancelReason: `Moved to ${column.name} in the task system` })
  } else {
    if (from === 'cancelled') Object.assign(changes, { prevStatus: remove, cancelledAt: remove, cancelledBy: remove, cancelledByUid: remove, cancelReason: remove })
    // aging: signedAt and liveAt follow the status, both ways
    if (RANK[want] >= 1 && !cur.signedAt) changes.signedAt = stamp
    if (RANK[want] >= 2 && !cur.liveAt) changes.liveAt = stamp
    if (RANK[want] < 1 && cur.signedAt) changes.signedAt = remove
    if (RANK[want] < 2 && cur.liveAt) changes.liveAt = remove
  }
  const line = `Moved the card to ${column.name} in the task system, so the listing is ${LEAD_STATUS_LABEL[want]}${from === 'cancelled' ? ' (reopened)' : ''}.`
  return { changes, line }
}

