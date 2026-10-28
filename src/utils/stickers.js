// Emoji, built-in stickers and "my stickers" for the team chat.
// An uploaded image is NOT stored in the app (no Firebase Storage, and no image data in Firestore). A personal sticker is a
// link to an image that is already on the web (for example a Google Drive picture shared with "anyone with the link").
export const EMOJI_GROUPS = [
  { name: 'Smileys', items: '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🤓 🥳 😏 😒 😔 😢 😭 😤 😡 🤯 😱 🤔 🤗 🤫 😴 🤒 🥱 😬 🙄'.split(' ') },
  { name: 'Hands', items: '👍 👎 👌 ✌️ 🤞 🤝 👏 🙌 🙏 💪 👋 🤙 ☝️ 👀 🫡 🫶'.split(' ') },
  { name: 'Hearts & more', items: '❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 🔥 ✨ ⭐ 🎉 🎊 🏆 ✅ ❌ ⚠️ 💡 📌 📎 📅 ⏰ 🚀'.split(' ') },
  { name: 'Food & fun', items: '☕ 🍵 🍕 🍔 🍜 🍣 🍰 🍪 🍺 🎂 ⚽ 🎮 🎵 🌧️ ☀️ 🌈 🐱 🐶 🐼 🦄'.split(' ') },
]
export const BUILT_IN_STICKERS = '👍 ❤️ 😂 🎉 🔥 👏 🙏 😍 😭 🤝 ✅ 👀 💪 🥳 😎 🤔 😴 🚀 💯 🙌'.split(' ')
export const MAX_MY_STICKERS = 30

// Inserts text at the caret; returns the new text and caret
export function insertAt(text, caret, add) {
  const at = Math.min(Math.max(caret ?? text.length, 0), text.length)
  return { text: text.slice(0, at) + add + text.slice(at), caret: at + add.length }
}

// A pasted link -> the https address to save, or '' if it can't be used. A Google Drive "share" link is turned into its picture address.
export function stickerUrl(input) {
  let u
  try { u = new URL(String(input ?? '').trim()) } catch { return '' }
  if (u.protocol !== 'https:') return ''
  if (u.hostname === 'drive.google.com') {
    const id = /\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get('id')
    if (!id) return ''
    return `https://drive.google.com/uc?export=view&id=${id}`
  }
  const href = u.href
  return href.length <= 490 ? href : ''
}
