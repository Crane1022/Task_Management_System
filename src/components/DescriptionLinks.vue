<script setup>
import { ref, computed, watch } from 'vue'
import { Paperclip, Link2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { addAttachment } from '@/services/taskService'
import { linksIn, parseLink, MAX_ATTACHMENTS } from '@/utils/links'

// Under the description: for each link found in it that is not attached yet, offer "Add to attachments".
// "No thanks" hides that link's button (remembered for this task in this browser). Nothing is uploaded; only the link is saved.
const props = defineProps({ taskId: String, text: String, attachments: { type: Array, default: () => [] } })
const auth = useAuthStore()
const ui = useUiStore()
const busy = ref('')
const key = `wb-hidden-links:${props.taskId}`
const hidden = ref(new Set())
try { hidden.value = new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { /* private window: the choice just isn't remembered */ }
const remember = () => { try { localStorage.setItem(key, JSON.stringify([...hidden.value].slice(-100))) } catch { /* ignore */ } }

// wait until typing pauses, so half-typed links don't flash a button
const settled = ref(props.text)
let timer
watch(() => props.text, (t) => { clearTimeout(timer); timer = setTimeout(() => (settled.value = t), 500) })

const full = computed(() => props.attachments.length >= MAX_ATTACHMENTS)
const offers = computed(() => linksIn(settled.value)
  .filter((u) => !hidden.value.has(u) && !props.attachments.some((a) => a.url === u))
  .map((u) => parseLink(u))
  .filter((l) => !l.error))

function hide(url) { hidden.value = new Set([...hidden.value, url]); remember() }
async function add(l) {
  busy.value = l.url
  try {
    await addAttachment(props.taskId, {
      id: crypto.randomUUID(), name: l.name, url: l.url, provider: l.provider, kind: l.kind,
      addedBy: auth.user.uid, addedByName: auth.profile.displayName || auth.profile.name, addedAt: Date.now(),
    }, auth.profile)
    ui.toast('Added to attachments')
  } catch (e) { ui.toast(['attachments/duplicate', 'attachments/limit'].includes(e.code) ? e.message : `Could not add the attachment: ${e.code ?? e.message}`, 'error') }
  finally { busy.value = '' }
}
</script>

<template>
  <ul v-if="offers.length" class="mt-2 space-y-1.5" aria-label="Links found in the description">
    <li v-for="l in offers" :key="l.url" class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg/60 px-2.5 py-1.5 text-xs">
      <Link2 class="h-3.5 w-3.5 shrink-0 text-muted" />
      <span class="min-w-0 flex-1 truncate font-semibold" :title="l.url">{{ l.name }} <span class="font-normal text-muted">· {{ l.provider }}</span></span>
      <button type="button" class="btn-primary px-2.5 py-1 text-xs" :disabled="full || busy === l.url" :title="full ? 'This task already has the most attachments allowed' : ''" @click="add(l)"><Paperclip class="h-3.5 w-3.5" />Add to attachments</button>
      <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="hide(l.url)">No thanks</button>
    </li>
  </ul>
</template>
