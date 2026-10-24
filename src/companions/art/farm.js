import { V, el, ellipsePath, eyes, blush, smile, paws, body, belly, tail, ear } from './parts.js'

const chickenFace = ellipsePath(50, 43, 22, 20)
const pigFace = ellipsePath(50, 45, 26, 22)
const cowFace = ellipsePath(50, 44, 23, 24)

export default {
  chicken: {
    under: tail(`<ellipse cx="76" cy="70" rx="5" ry="14" transform="rotate(28 76 70)" fill="${V.tail}"/><ellipse cx="80" cy="76" rx="5" ry="13" transform="rotate(48 80 76)" fill="${V.tail}"/><ellipse cx="72" cy="68" rx="5" ry="14" transform="rotate(8 72 68)" fill="${V.tail}"/>`, 70, 82)
      + body(50, 76, 26, 21, el(60, 78, 13, 9, V.sec)) + `<path d="M40 94v-3M60 94v-3" stroke="${V.paw}" stroke-width="3" stroke-linecap="round"/>` + paws(96, 10, 8, 3.2),
    head: `<g class="pet-comb">${el(43, 23, 5.5, 5.5, V.ear)}${el(50, 19.5, 6.5, 6.5, V.ear)}${el(57, 23, 5.5, 5.5, V.ear)}</g>`
      + `<path d="${chickenFace}" fill="${V.face}"/>` + el(50, 59, 3.8, 5.5, V.ear),
    front: eyes(38, 10.5, 2.7) + `<path d="M44 45h12l-6 9z" fill="${V.nose}"/><path d="M44 45h12" stroke="#c97a14" stroke-width="1" opacity=".6"/>` + blush(48, 17),
    face: { d: chickenFace, box: [28, 23, 44, 40] },
    anchors: { top: [50, 17], head: [50, 40], neck: [50, 64], w: 44 },
  },

  pig: {
    under: tail(`<path d="M74 82c10 0 11-8 5-10c-4-1-6 3-3 4" fill="none" stroke="${V.tail}" stroke-width="3" stroke-linecap="round"/>`, 74, 82)
      + body(50, 77, 25, 20) + paws(94, 13, 7.5, 4.6),
    head: ear('l', 34, 28, `<path d="M30 38L25 18L45 28z" fill="${V.ear}" stroke="${V.ear}" stroke-width="3" stroke-linejoin="round"/>`)
      + ear('r', 66, 28, `<path d="M70 38L75 18L55 28z" fill="${V.ear}" stroke="${V.ear}" stroke-width="3" stroke-linejoin="round"/>`)
      + `<path d="${pigFace}" fill="${V.face}"/>` + el(50, 53, 13, 9.5, V.sec),
    front: eyes(40, 13.5, 2.9) + el(45.5, 53, 2, 3, V.nose) + el(54.5, 53, 2, 3, V.nose) + smile(60.5, 4) + blush(50, 22),
    face: { d: pigFace, box: [24, 23, 52, 44] },
    anchors: { top: [50, 22], head: [50, 42], neck: [50, 66], w: 52 },
  },

  cow: {
    under: tail(`<path d="M72 78C84 76 86 66 82 58" fill="none" stroke="${V.tail}" stroke-width="3.4" stroke-linecap="round"/>${el(82, 56, 4, 6.5, V.mark)}`, 72, 80)
      + body(50, 77, 25, 20, el(36, 72, 8, 6.5, V.mark) + el(62, 82, 9, 6, V.mark)) + paws(94, 13, 8, 5),
    head: `<path d="M37 27Q30 14 35 12Q41 17 43 26z" fill="#efe3c4"/><path d="M63 27Q70 14 65 12Q59 17 57 26z" fill="#efe3c4"/>`
      + ear('l', 30, 34, `<ellipse cx="22" cy="36" rx="11" ry="5.6" transform="rotate(-18 22 36)" fill="${V.ear}"/><ellipse cx="23" cy="36" rx="6.6" ry="3" transform="rotate(-18 23 36)" fill="${V.inner}"/>`)
      + ear('r', 70, 34, `<ellipse cx="78" cy="36" rx="11" ry="5.6" transform="rotate(18 78 36)" fill="${V.ear}"/><ellipse cx="77" cy="36" rx="6.6" ry="3" transform="rotate(18 77 36)" fill="${V.inner}"/>`)
      + `<path d="${cowFace}" fill="${V.face}"/>` + el(37, 33, 10, 8.5, V.mark, 'opacity=".95"') + el(50, 57, 16, 10.5, V.sec),
    front: eyes(42, 12, 2.9) + el(44.5, 57, 2.2, 3, V.nose) + el(55.5, 57, 2.2, 3, V.nose) + smile(63, 4) + blush(52, 21),
    face: { d: cowFace, box: [27, 20, 46, 48] },
    anchors: { top: [50, 14], head: [50, 44], neck: [50, 66], w: 46 },
  },
}
