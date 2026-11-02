// Each person arranges their own sidebar: the order of their workspaces and the folders they put them in.
// It is saved per person (users/{uid}/settings/sidebar) and changes nothing for anyone else.
//   layout = { order: ['f:<folderId>', 'w:<workspaceId>', ...], folders: { <folderId>: { name, wsIds: [...] } } }
//   tree   = [ { kind: 'ws', key, ws } | { kind: 'folder', key, id, name, items: [ws, ...] } ]  (what the sidebar draws)
export const MAX_FOLDER_NAME = 40

export const wsKey = (id) => `w:${id}`
export const folderKey = (id) => `f:${id}`
export const newFolderId = () => Math.random().toString(36).slice(2, 10)
export const cleanFolderName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FOLDER_NAME)

// Layout + the workspaces this person can see -> what to draw. Anything unknown is handled safely:
// a workspace that is gone is dropped, a new one is added at the end, and a workspace is never shown twice.
export function buildTree(workspaces, layout) {
  const byId = new Map((workspaces ?? []).map((w) => [w.id, w]))
  const folders = layout?.folders && typeof layout.folders === 'object' ? layout.folders : {}
  const used = new Set()
  const made = new Map()
  for (const [id, f] of Object.entries(folders)) {
    const items = []
    for (const wid of Array.isArray(f?.wsIds) ? f.wsIds : []) {
      if (byId.has(wid) && !used.has(wid)) { used.add(wid); items.push(byId.get(wid)) }
    }
    made.set(id, { kind: 'folder', key: folderKey(id), id, name: cleanFolderName(f?.name) || 'Folder', items })
  }
  const tree = []
  const placed = new Set()
  for (const k of Array.isArray(layout?.order) ? layout.order : []) {
    if (typeof k !== 'string') continue
    if (k.startsWith('f:') && made.has(k.slice(2)) && !placed.has(k)) { tree.push(made.get(k.slice(2))); placed.add(k) }
    else if (k.startsWith('w:')) {
      const id = k.slice(2)
      if (byId.has(id) && !used.has(id) && !placed.has(k)) { tree.push({ kind: 'ws', key: k, ws: byId.get(id) }); placed.add(k); used.add(id) }
    }
  }
  for (const f of made.values()) if (!placed.has(f.key)) { tree.push(f); placed.add(f.key) }
  for (const w of byId.values()) if (!used.has(w.id)) { tree.push({ kind: 'ws', key: wsKey(w.id), ws: w }); used.add(w.id) }
  return tree
}

// What is drawn -> what is saved
export function treeToLayout(tree) {
  const order = []
  const folders = {}
  for (const e of tree) {
    if (e.kind === 'folder') {
      order.push(folderKey(e.id))
      folders[e.id] = { name: cleanFolderName(e.name) || 'Folder', wsIds: e.items.map((w) => w.id) }
    } else order.push(wsKey(e.ws.id))
  }
  return { order, folders }
}

// Dragging between the main list and a folder moves the dragged object as it is, so a workspace can arrive in a folder
// still wrapped as { kind: 'ws', ws }, or arrive in the main list as a bare workspace. Put every entry back in its proper shape
// before saving (a missing id would reach Firestore as undefined, which it refuses: "invalid-argument").
export function normalizeTree(tree) {
  const seen = new Set()
  const take = (w) => { if (!w?.id || seen.has(w.id)) return null; seen.add(w.id); return w }
  return (tree ?? []).map((e) => {
    if (e?.kind === 'folder') {
      const items = e.items.map((x) => take(x?.kind === 'ws' ? x.ws : x)).filter(Boolean)
      return { ...e, items }
    }
    const ws = take(e?.kind === 'ws' ? e.ws : e)
    return ws ? { kind: 'ws', key: wsKey(ws.id), ws } : null
  }).filter(Boolean)
}
