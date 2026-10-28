<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Send, Trash2, Lock, Smile, X, Plus } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { subscribeChat, sendChat, deleteMessage, subscribeStickers, addSticker, deleteSticker } from '@/services/workspaceService'
import { formatDateTime } from '@/utils/dates'
import { displayOf } from '@/utils/constants'
import { activeQuery, insertMention, resolveMentions, splitMentions } from '@/utils/mentions'
import { EMOJI_GROUPS, BUILT_IN_STICKERS, MAX_MY_STICKERS, insertAt, stickerUrl } from '@/utils/stickers'
import UserAvatar from './UserAvatar.vue'

// One conversation of a Super Private workspace (the Everyone channel, a group or a DM): @tags, emoji, stickers and your own saved stickers.
// Only its people can read or write (firestore.rules). `chat` = the group/DM document, or null for the Everyone channel.
const props = defineProps({ workspaceId: String, workspace: Object, chat: { type: Object, default: null }, users: { type: Object, default: () => ({}) }, isAdmin: Boolean })
const auth = useAuthStore()
const ui = useUiStore()
const notify = useNotificationStore()
const messages = ref([])
const loading = ref(true)
const failed = ref(false)
const text = ref('')
const busy = ref(false)
const list = ref(null)
const box = ref(null)
const MAX = 1000

let unsub, unsubStickers
onMounted(() => {
  unsub = subscribeChat(props.workspaceId, props.chat?.id ?? '', (m) => { messages.value = m; loading.value = false }, () => { failed.value = true; loading.value = false })
  if (auth.user?.uid) unsubStickers = subscribeStickers(auth.user.uid, (s) => (mine.value = s), () => {})
})
onUnmounted(() => { unsub?.(); unsubStickers?.() })
watch(messages, async () => { await nextTick(); if (list.value) list.value.scrollTop = list.value.scrollHeight })

const isMine = (m) => m.userId === auth.user?.uid

// ----- @tag -----
const caret = ref(0)
const picked = ref([])
const hi = ref(0)
const people = computed(() => (props.chat ? props.chat.memberIds : Object.keys(props.workspace?.members ?? {}))
  .filter((id) => id !== auth.user?.uid && props.users[id]).map((id) => ({ ...props.users[id], id })))
const query = computed(() => activeQuery(text.value, caret.value))
const matches = computed(() => {
  if (!query.value) return []
  const q = query.value.query.toLowerCase()
  return people.value.filter((u) => displayOf(u).toLowerCase().includes(q)).slice(0, 6)
})
const syncCaret = () => { caret.value = box.value?.selectionStart ?? text.value.length; hi.value = 0 }
function pick(u) {
  const name = displayOf(u)
  const r = insertMention(text.value, caret.value, name)
  text.value = r.text
  if (!picked.value.some((p) => p.id === u.id)) picked.value.push({ id: u.id, name })
  caret.value = r.caret
  requestAnimationFrame(() => { box.value?.focus(); box.value?.setSelectionRange(r.caret, r.caret) })
}
function onKey(e) {
  if (matches.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); hi.value = (hi.value + 1) % matches.value.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); hi.value = (hi.value + matches.value.length - 1) % matches.value.length; return }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches.value[hi.value]); return }
    if (e.key === 'Escape') { caret.value = 0; return }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}
const parts = (m) => splitMentions(m.text ?? '', (m.mentions ?? []).map((id) => (props.users[id] ? displayOf(props.users[id]) : '')))

// ----- emoji and stickers -----
const panel = ref('') // '' | 'emoji' | 'stickers'
const group = ref(0)
const mine = ref([])
const newUrl = ref('')
const addEmoji = (e) => {
  const r = insertAt(text.value, box.value?.selectionStart, e)
  text.value = r.text
  requestAnimationFrame(() => { box.value?.focus(); box.value?.setSelectionRange(r.caret, r.caret); syncCaret() })
}
async function saveSticker() {
  const url = stickerUrl(newUrl.value)
  if (!url) { ui.toast('Paste a picture link that starts with https://', 'error'); return }
  if (mine.value.length >= MAX_MY_STICKERS) { ui.toast(`You can keep ${MAX_MY_STICKERS} stickers. Remove one first.`, 'error'); return }
  if (mine.value.some((s) => s.url === url)) { ui.toast('You already saved that sticker'); return }
  try { await addSticker(auth.user.uid, url); newUrl.value = ''; ui.toast('Sticker saved') }
  catch (e) { ui.toast(`Could not save the sticker: ${e.code ?? e.message}`, 'error') }
}
const removeSticker = (s) => deleteSticker(auth.user.uid, s.id).catch((e) => ui.toast(`Could not remove it: ${e.code ?? e.message}`, 'error'))

// ----- sending -----
async function deliver(message) {
  if (busy.value) return
  busy.value = true
  try {
    await sendChat(props.workspaceId, props.chat?.id ?? '', message, auth.profile)
    if (message.mentions?.length && props.workspace) notify.chatMention(props.workspace, message.text, message.mentions) // best effort
    return true
  } catch (e) { ui.toast(`Could not send: ${e.code ?? e.message}`, 'error') }
  finally { busy.value = false }
}
async function send() {
  const t = text.value.trim()
  if (!t) return
  const ok = await deliver({ text: t, mentions: resolveMentions(t, picked.value) })
  if (ok) { text.value = ''; picked.value = []; panel.value = '' }
}
async function sendSticker(sticker) { if (await deliver({ text: '', sticker })) panel.value = '' }
const remove = (m) => deleteMessage(props.workspaceId, props.chat?.id ?? '', m.id).catch((e) => ui.toast(`Could not delete: ${e.code ?? e.message}`, 'error'))
const broken = ref(new Set())
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col" aria-label="Chat">
    <p class="flex items-center gap-1.5 border-b border-line px-4 py-2 text-xs font-bold text-muted"><Lock class="h-3.5 w-3.5" />{{ chat ? (chat.type === 'dm' ? 'Direct message. Only the two of you can read it.' : 'Group chat. Only the people in this group can read it.') : 'Everyone channel. All members of this Super Private workspace can read it.' }}</p>
    <div ref="list" class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      <p v-if="loading" class="text-sm text-muted">Loading…</p>
      <p v-else-if="failed" class="text-sm font-semibold text-red-600" role="alert">The chat could not be loaded.</p>
      <p v-else-if="!messages.length" class="py-8 text-center text-sm text-muted">No messages yet. Say hello.</p>
      <div v-for="m in messages" :key="m.id" class="group flex gap-2.5" :class="isMine(m) && 'flex-row-reverse'">
        <UserAvatar :user="users[m.userId] ?? { name: m.userName }" :size="30" />
        <div class="min-w-0 max-w-[80%]" :class="isMine(m) && 'text-right'">
          <p class="text-xs"><b>{{ m.userName }}</b> <span class="text-muted">· {{ formatDateTime(m.createdAt) }}</span></p>
          <p v-if="m.sticker?.emoji" class="mt-0.5 text-5xl leading-tight" aria-label="Sticker">{{ m.sticker.emoji }}</p>
          <template v-else-if="m.sticker?.url">
            <img v-if="!broken.has(m.id)" :src="m.sticker.url" alt="Sticker" class="mt-0.5 inline-block max-h-32 max-w-[10rem] object-contain" loading="lazy" referrerpolicy="no-referrer" @error="broken.add(m.id)" />
            <p v-else class="mt-0.5 inline-block rounded-xl bg-bg px-3 py-2 text-xs text-muted">Sticker picture is not available</p>
          </template>
          <p v-if="m.text" class="mt-0.5 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm" :class="isMine(m) ? 'bg-accent text-white' : 'bg-bg'"><template v-for="(p, i) in parts(m)" :key="i"><span v-if="p.mention" class="rounded px-1 font-bold" :class="isMine(m) ? 'bg-white/25' : 'bg-accent-soft text-accent'">{{ p.text }}</span><template v-else>{{ p.text }}</template></template></p>
          <button v-if="isMine(m) || isAdmin" class="ml-1 hidden align-middle text-muted hover:text-red-600 group-hover:inline" aria-label="Delete message" @click="remove(m)"><Trash2 class="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>

    <!-- emoji / sticker panel -->
    <div v-if="panel" class="border-t border-line bg-bg/50 p-3">
      <template v-if="panel === 'emoji'">
        <div class="mb-2 flex gap-1 text-xs font-bold"><button v-for="(g, i) in EMOJI_GROUPS" :key="g.name" type="button" class="rounded-full px-2.5 py-1" :class="group === i ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'" @click="group = i">{{ g.name }}</button></div>
        <div class="flex max-h-32 flex-wrap gap-1 overflow-y-auto"><button v-for="e in EMOJI_GROUPS[group].items" :key="e" type="button" class="rounded-lg p-1 text-xl hover:bg-surface" :aria-label="`Add ${e}`" @click="addEmoji(e)">{{ e }}</button></div>
      </template>
      <template v-else>
        <p class="mb-1 text-xs font-bold text-muted">Stickers</p>
        <div class="flex flex-wrap gap-1"><button v-for="s in BUILT_IN_STICKERS" :key="s" type="button" class="rounded-lg p-1 text-3xl hover:bg-surface" :aria-label="`Send sticker ${s}`" @click="sendSticker({ emoji: s })">{{ s }}</button></div>
        <p class="mb-1 mt-3 text-xs font-bold text-muted">My stickers <span class="font-normal">({{ mine.length }}/{{ MAX_MY_STICKERS }})</span></p>
        <div class="flex flex-wrap gap-2">
          <div v-for="s in mine" :key="s.id" class="group/s relative">
            <button type="button" class="block rounded-lg p-1 hover:bg-surface" aria-label="Send my sticker" @click="sendSticker({ url: s.url })"><img :src="s.url" alt="My sticker" class="h-14 w-14 object-contain" loading="lazy" referrerpolicy="no-referrer" /></button>
            <button type="button" class="absolute -right-1 -top-1 hidden rounded-full bg-surface p-0.5 text-muted shadow hover:text-red-600 group-hover/s:block" aria-label="Remove this sticker" @click="removeSticker(s)"><X class="h-3 w-3" /></button>
          </div>
          <p v-if="!mine.length" class="text-xs text-muted">None yet. Add a picture link below.</p>
        </div>
        <form class="mt-2 flex gap-2" @submit.prevent="saveSticker">
          <input v-model="newUrl" class="input flex-1 py-1.5 text-xs" placeholder="Paste a picture link (https://…, or a Google Drive share link)" aria-label="Picture link for a new sticker" />
          <button type="submit" class="btn-ghost text-xs" :disabled="!newUrl.trim()"><Plus class="h-3.5 w-3.5" />Save</button>
        </form>
        <p class="mt-1 text-[11px] text-muted">Pictures are not uploaded to the app. Share the picture as “anyone with the link” and paste its link; the link is saved for you.</p>
      </template>
    </div>

    <form class="flex items-end gap-2 border-t border-line p-3" @submit.prevent="send">
      <button type="button" class="btn-ghost px-2.5" :class="panel === 'emoji' && 'text-accent'" aria-label="Emoji" @click="panel = panel === 'emoji' ? '' : 'emoji'"><Smile class="h-4 w-4" /></button>
      <button type="button" class="btn-ghost px-2.5 text-xs font-bold" :class="panel === 'stickers' && 'text-accent'" aria-label="Stickers" @click="panel = panel === 'stickers' ? '' : 'stickers'">Stickers</button>
      <div class="relative flex-1">
        <ul v-if="matches.length" class="absolute bottom-full left-0 z-20 mb-1 max-h-52 w-64 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl" role="listbox" aria-label="People you can tag">
          <li v-for="(u, i) in matches" :key="u.id" role="option" :aria-selected="i === hi">
            <button type="button" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm" :class="i === hi ? 'bg-accent-soft text-accent' : 'hover:bg-bg'" @mousedown.prevent="pick(u)"><UserAvatar :user="u" :size="22" /><span class="truncate font-semibold">{{ displayOf(u) }}</span></button>
          </li>
        </ul>
        <textarea ref="box" v-model="text" rows="1" class="input w-full" :maxlength="MAX" placeholder="Message the team… type @ to tag" aria-label="Write a message" @input="syncCaret" @click="syncCaret" @keyup.left="syncCaret" @keyup.right="syncCaret" @keydown="onKey" />
      </div>
      <button type="submit" class="btn-primary" :disabled="!text.trim() || busy" aria-label="Send message"><Send class="h-4 w-4" /></button>
    </form>
  </section>
</template>
