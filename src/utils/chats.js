// Conversations inside a Super Private workspace: the "Everyone" channel, group chats and direct messages (DMs).
export const EVERYONE = '' // the id used for the workspace-wide channel
export const MAX_GROUP = 50

// A DM between two people always has the same id, so it is never made twice
export const dmId = (a, b) => `dm_${[a, b].sort().join('_')}`

// The name shown for a chat: a group's own name, or the other person's name for a DM
export function chatTitle(chat, meId, nameOf) {
  if (chat.type === 'dm') return nameOf(chat.memberIds.find((id) => id !== meId)) || 'Direct message'
  return chat.name || 'Group'
}

// Groups first (A-Z), then DMs (A-Z by the other person)
export function sortChats(chats, meId, nameOf) {
  const rank = (c) => (c.type === 'group' ? 0 : 1)
  return [...chats].sort((a, b) => rank(a) - rank(b) || chatTitle(a, meId, nameOf).localeCompare(chatTitle(b, meId, nameOf)))
}

// What a new/edited group may be. Returns '' when fine, otherwise the problem in words.
export function groupProblem(name, memberIds, workspaceMemberIds) {
  if (!String(name ?? '').trim()) return 'Give the group a name'
  if (String(name).trim().length > 60) return 'The group name is too long (60 letters at most)'
  if (memberIds.length < 2) return 'Pick at least one other person'
  if (memberIds.length > MAX_GROUP) return `A group can have ${MAX_GROUP} people at most`
  if (memberIds.some((id) => !workspaceMemberIds.includes(id))) return 'Everyone in a group must be a member of this workspace'
  return ''
}
