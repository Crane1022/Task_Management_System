<script setup>
import { ref, computed, watch } from 'vue'
import { X, Link2, Ticket } from 'lucide-vue-next'
import { ticketChoices, checkDriveLink } from '@/services/pmsIssues'
import { TICKET_TYPES, tagLabel } from '@/utils/issueStatus'

// The PMS "Raise a ticket" fields, in the new-task form of a Maintenance board (the board is the property).
// Starts as In-house; a unit can be chosen for either type (required for Customer).
// Title and "What happened" are the task's own Title and Description. part="top": Type and Unit; part="bottom":
// tags and Drive links. Both parts share one `ticket` object: { type, unit, unitText, tags, links, choices, ready }.
const props = defineProps({
  board: Object, // the Maintenance board the task goes to
  profile: Object, // the signed-in person (their PMS role is always tagged)
  part: { type: String, default: 'top' },
})
const ticket = defineModel({ type: Object, required: true })

const loading = ref(false)
const loadError = ref('')
async function load() {
  if (props.part !== 'top' || !props.board) return // the top part loads, for both
  loading.value = true; loadError.value = ''
  try {
    const c = await ticketChoices(props.board, props.profile)
    const keep = (ticket.value.tags || []).filter((g) => c.tags.includes(g))
    Object.assign(ticket.value, {
      choices: c, unit: null, unitText: '', ready: true,
      // own role (always) and Operations, so the ticket comes to this workspace
      tags: [...new Set([c.myTag, 'Operations', ...keep].filter(Boolean))],
      type: ticket.value.type || 'inhouse', // a ticket raised from the task system starts as In-house (it can be changed)
    })
  } catch (e) { loadError.value = e.message; ticket.value.ready = false }
  loading.value = false
}
watch(() => props.board?.id, load, { immediate: true })

const c = computed(() => ticket.value.choices)
// the units of the board's property
const unitGroups = computed(() => {
  const groups = {}
  for (const u of c.value?.units ?? []) (groups[u.propertyName || 'Other'] ??= []).push(u)
  return Object.entries(groups)
})
const unitId = computed({
  get: () => ticket.value.unit?.id ?? '',
  set: (id) => { ticket.value.unit = (c.value?.units ?? []).find((u) => u.id === id) ?? null },
})

// ----- tags: chips, your own role locked; the drop-down adds one -----
const addPick = ref('')
const addable = computed(() => (c.value?.tags ?? []).filter((g) => !ticket.value.tags.includes(g)))
function addTag() { if (addPick.value && !ticket.value.tags.includes(addPick.value)) ticket.value.tags.push(addPick.value); addPick.value = '' }
const removeTag = (g) => { ticket.value.tags = ticket.value.tags.filter((x) => x !== g) }

// ----- Drive links -----
const linkName = ref('')
const linkUrl = ref('')
const linkError = ref('')
function addLink() {
  const r = checkDriveLink(linkName.value, linkUrl.value, ticket.value.links)
  if (r.error) { linkError.value = r.error; return }
  ticket.value.links.push(r.link)
  linkName.value = ''; linkUrl.value = ''; linkError.value = ''
}
</script>

<template>
  <!-- Type and Unit -->
  <section v-if="part === 'top'" class="space-y-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
    <p class="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-accent"><Ticket class="h-4 w-4" />PMS ticket</p>
    <p class="text-[11px] text-muted">
      This task is raised as a ticket on the PMS Issues page<template v-if="c?.property?.name"> for {{ c.property.name }}</template>. Its status, title and description stay the same in both places.
    </p>
    <p v-if="loading" class="text-xs text-muted">Loading units and roles from the PMS…</p>
    <p v-else-if="loadError" class="text-xs font-semibold text-red-600" role="alert">{{ loadError }}</p>
    <template v-else-if="c">
      <div>
        <span class="label">Type <span class="text-red-600">*</span></span>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ticket type">
          <button v-for="ty in TICKET_TYPES" :key="ty.id" type="button" role="radio" :aria-checked="String(ticket.type === ty.id)"
            class="grid gap-0.5 rounded-xl border px-3 py-2 text-left" :class="ticket.type === ty.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'"
            @click="ticket.type = ty.id">
            <b class="text-sm" :class="ticket.type === ty.id && 'text-accent'">{{ ty.name }}</b><small class="text-xs text-muted">{{ ty.hint }}</small>
          </button>
        </div>
      </div>
      <!-- the unit can be chosen for both types: needed for Customer, optional for In-house -->
      <div>
        <label class="label" for="pt-unit">Unit <span v-if="ticket.type === 'customer'" class="text-red-600">*</span><span v-else class="font-normal normal-case text-muted">(optional)</span></label>
        <select v-if="c.unitsReadable && c.units.length" id="pt-unit" v-model="unitId" class="input">
          <option value="">{{ ticket.type === 'customer' ? 'Choose the unit' : 'No unit' }}</option>
          <optgroup v-for="[name, list] in unitGroups" :key="name" :label="name"><option v-for="u in list" :key="u.id" :value="u.id">{{ u.unitCode }}</option></optgroup>
        </select>
        <input v-else id="pt-unit" v-model="ticket.unitText" class="input uppercase" maxlength="40" placeholder="Type the unit code, e.g. NA-12-03" />
        <p v-if="!c.unitsReadable" class="mt-1 text-[11px] text-muted">Your PMS role can't read the unit list, so type the unit code.</p>
        <p v-else-if="!c.propertyFound" class="mt-1 text-[11px] font-semibold text-amber-700">No PMS property is called “{{ board?.name }}”. Rename the board to the property's exact name, or type the unit code.</p>
        <p v-else-if="!c.units.length" class="mt-1 text-[11px] text-muted">No units found for this property in the PMS. Type the unit code.</p>
      </div>
    </template>
  </section>

  <!-- Tags and Drive links -->
  <section v-else-if="c" class="space-y-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
    <div>
      <span class="label">Tag the roles who should handle it</span>
      <div class="flex min-h-[2.5rem] flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2">
        <span v-for="g in c.tags.filter((x) => ticket.tags.includes(x))" :key="g" class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
          {{ tagLabel(g) }}
          <button v-if="g !== c.myTag" type="button" class="rounded-full p-0.5 hover:bg-accent hover:text-white" :aria-label="`Remove ${tagLabel(g)}`" @click="removeTag(g)"><X class="h-3 w-3" /></button>
          <span v-else class="text-[10px] font-semibold opacity-70" title="Your role is always tagged">(you)</span>
        </span>
        <span v-if="!ticket.tags.length" class="text-xs text-muted">No roles tagged</span>
      </div>
      <select v-if="addable.length" v-model="addPick" class="input mt-2" aria-label="Add a role" @change="addTag">
        <option value="">+ Add a role…</option>
        <option v-for="g in addable" :key="g" :value="g">{{ tagLabel(g) }}</option>
      </select>
    </div>
    <div>
      <label class="label" for="pt-lname">Add Drive link</label>
      <div class="flex flex-wrap gap-2">
        <input id="pt-lname" v-model="linkName" class="input min-w-0 flex-1" placeholder="Name, e.g. Photo of the leak" />
        <input v-model="linkUrl" class="input min-w-0 flex-[2]" placeholder="Paste the Google Drive link" aria-label="Google Drive link" @keydown.enter.prevent="addLink" />
        <button type="button" class="btn-ghost" @click="addLink">Add</button>
      </div>
      <p v-if="linkError" class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ linkError }}</p>
      <p class="mt-1 text-[11px] text-muted">Files stay in the company Google Drive; the ticket keeps only the link. To upload a file, use the ticket in the PMS.</p>
      <div v-if="ticket.links.length" class="mt-2 flex flex-wrap gap-2">
        <span v-for="(l, i) in ticket.links" :key="l.url" class="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs">
          <Link2 class="h-3.5 w-3.5 text-muted" />{{ l.name }}
          <button type="button" class="text-muted hover:text-red-600" :aria-label="`Remove ${l.name}`" @click="ticket.links.splice(i, 1)"><X class="h-3 w-3" /></button>
        </span>
      </div>
    </div>
  </section>
</template>
