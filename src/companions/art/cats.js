// The five original cats, drawn full size. Same colours, ears, stripes and patches as the peeking cats (catSkins.js);
// the face sits a little lower here because the whole head is visible, not just the top of it.
import { V, el, ellipsePath, eyes, blush, paws, body, tail, ear, noseTri, whiskers } from './parts.js'

const faceD = ellipsePath(50, 42, 26, 21)

// One drawing, three looks, like the peeking cats: orange and gray have tabby stripes, calico has patches, black and white are plain.
const makeCat = ({ stripes = false, patches = false } = {}) => ({
    under: tail(`<path d="M68 90C91 92 95 66 85 57" fill="none" stroke="${V.tail}" stroke-width="9" stroke-linecap="round"/>`, 68, 88)
      + body(50, 78, 22, 19) + paws(94, 11, 7.5, 4.5),
    head: ear('l', 34, 30, `<polygon points="25,34 29,10 44,23" fill="${V.ear}"/><polygon points="29,29 31,16 38.5,23" fill="${V.inner}"/>`)
      + ear('r', 66, 30, `<polygon points="75,34 71,10 56,23" fill="${V.ear}"/><polygon points="71,29 69,16 61.5,23" fill="${V.inner}"/>`)
      + `<path d="${faceD}" fill="${V.face}"/>`
      // calico patches and tabby stripes use the marking colour, as on the peeking cats
      + (stripes ? `<path d="M50 23v8M43 24.5l2 6M57 24.5l-2 6" fill="none" stroke="${V.mark}" stroke-width="2.2" stroke-linecap="round"/>` : '')
      + (patches ? `${el(36, 28, 9, 7.5, V.mark)}${el(66, 29.5, 6.5, 5.2, V.tail)}` : ''),
    front: eyes(40, 11.5, 3) + noseTri(46.5, 3.2) + `<path class="pet-mouth" d="M50 49.7v2M50 51.7q-3.2 3.2-6.4.6M50 51.7q3.2 3.2 6.4.6" fill="none" stroke="#6b4a4a" stroke-width="1.3" stroke-linecap="round"/>`
      + whiskers(48, 31, 16, 3) + blush(50, 19),
    face: { d: faceD, box: [24, 21, 52, 42] },
    anchors: { top: [50, 14], head: [50, 40], neck: [50, 64], w: 52 },
})

export default {
  cat: makeCat(),
  'cat-tabby': makeCat({ stripes: true }),
  'cat-calico': makeCat({ patches: true }),
}
