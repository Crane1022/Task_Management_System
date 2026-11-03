<template>
  <div class="modal-back" @click.self="emit('close')" @keydown.esc="emit('close')">
    <form class="modal" role="dialog" aria-label="Renewal reminders" style="max-width: 520px" @submit.prevent="save">
      <h2>Renewal reminders · {{ form.name }}</h2>
      <p class="help">Staff are reminded {{ REMIND_DAYS.slice(0, -1).join(', ') }} days before an agreement ends and on the end date,
        in the PMS and by email. The agreements also show on the Renewals page.</p>
      <div class="notice error" v-if="error">{{ error }}</div>

      <label class="ag-check-row"><input type="checkbox" v-model="on"> Track renewals for this form</label>

      <template v-if="on">
        <div class="field">
          <label for="rnEnd">Which field is the end date?</label>
          <select id="rnEnd" class="input select" v-model="endFieldId" required>
            <option value="" disabled>Choose a date field</option>
            <option v-for="f in dateFields" :key="f.id" :value="f.id">{{ f.label }}{{ f.type === 'formula' ? ' (formula)' : '' }}</option>
          </select>
          <span class="help" v-if="!dateFields.length">This form has no date fields. Add one (e.g. Completion Date) in the form builder first.</span>
        </div>
        <div class="field">
          <label for="rnRole">Also remind everyone in</label>
          <select id="rnRole" class="input select" v-model="role">
            <option value="">No role (only the people below)</option>
            <option v-for="(label, key) in ROLE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
          <span class="help">The person who made the record and the person in charge of it are always reminded.</span>
        </div>
      </template>

      <div class="modal-foot">
        <button type="button" class="btn" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="busy || (on && !endFieldId)">{{ busy ? 'Saving…' : 'Save' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
// Agreement Setup → Forms → Renewal: which date field ends the agreement, and which role is also reminded.
import { ref, computed } from 'vue';
import { saveForm, audit } from '@/lib/agreements/data.js';
import { endFieldsOf, REMIND_DAYS } from '@/lib/agreements/renewals.js';
import { ROLE_LABEL } from '@/lib/firebase.js';

const props = defineProps({ form: { type: Object, required: true } });
const emit = defineEmits(['close', 'saved']);
const r = props.form.renewal || {};
const dateFields = computed(() => endFieldsOf(props.form));
// Guess the end date field the first time: a date field named like "Completion", "End" or "Expiry".
const guess = () => (dateFields.value.find(f => /complet|end|expir/i.test(f.label)) || {}).id || '';
const on = ref(r.on ?? true), endFieldId = ref(r.endFieldId || guess()), role = ref(r.role || '');
const busy = ref(false), error = ref('');

async function save() {
  busy.value = true; error.value = '';
  const renewal = { on: on.value, endFieldId: on.value ? endFieldId.value : (r.endFieldId || ''), role: role.value };
  try {
    await saveForm(props.form.id, { renewal });
    audit('agreement.form.renewal', `agreementForms/${props.form.id}`, on.value ? `Renewal reminders on (${role.value || 'no role'})` : 'Renewal reminders off');
    emit('saved', renewal);
  } catch (e) { error.value = e.code === 'permission-denied' ? 'You don\'t have permission to change this form.' : 'Could not save: ' + e.message; busy.value = false; }
}
</script>
