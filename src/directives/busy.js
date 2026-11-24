// v-busy="flag" (24 Nov 2026): while `flag` is true the button shows a spinner, can't be clicked again and tells
// screen readers it is busy. Its own icon is swapped for the spinner (style.css: .is-busy). The button's text can
// still change too ("Save" -> "Saving…") in the template.
function apply(el, busy, wasDisabledByUs) {
  el.classList.toggle('is-busy', !!busy)
  if (busy) el.setAttribute('aria-busy', 'true')
  else el.removeAttribute('aria-busy')
  // only lock the button ourselves; a :disabled binding on the same button keeps working on its own
  if (busy && !el.disabled) { el.disabled = true; el.dataset.busyLocked = '1' }
  else if (!busy && el.dataset.busyLocked) { el.disabled = false; delete el.dataset.busyLocked }
}

export const vBusy = {
  mounted: (el, { value }) => apply(el, value),
  updated: (el, { value, oldValue }) => { if (value !== oldValue || el.classList.contains('is-busy') !== !!value) apply(el, value) },
}

export default { install: (app) => app.directive('busy', vBusy) }
