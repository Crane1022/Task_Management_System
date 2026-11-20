// One app-wide glass confirm box, opened from anywhere with a promise:
//   const ok = await confirmDialog({ title: 'Delete task?', confirmText: 'Delete', danger: true })
// <ConfirmHost /> must be placed once in App.vue.
import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: 'Cancel',
  danger: false,
  _resolve: null,
})

export function confirmDialog(opts = {}) {
  // a second request while one is open answers the first with "cancel"
  if (confirmState._resolve) confirmState._resolve(false)
  Object.assign(confirmState, {
    title: opts.title || 'Are you sure?',
    message: opts.message || '',
    confirmText: opts.confirmText || 'OK',
    cancelText: opts.cancelText || 'Cancel',
    danger: !!opts.danger,
    open: true,
  })
  return new Promise((resolve) => { confirmState._resolve = resolve })
}

export function answerConfirm(value) {
  const r = confirmState._resolve
  confirmState._resolve = null
  confirmState.open = false
  if (r) r(value)
}

// The standard "leave without saving?" question used by every form.
export function confirmLeave() {
  return confirmDialog({
    title: 'Leave without saving?',
    message: "You've typed in this form. If you leave now, what you typed will be lost.",
    confirmText: 'Leave without saving',
    cancelText: 'Keep editing',
  })
}
