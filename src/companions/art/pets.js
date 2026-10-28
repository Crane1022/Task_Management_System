import { V, el, ellipsePath, eyes, blush, smile, paws, body, belly, tail, ear, noseTri, noseDot, whiskers } from './parts.js'

const dogFace = ellipsePath(50, 42, 25, 22)
const bunnyFace = ellipsePath(50, 46, 22, 20)
const mouseFace = ellipsePath(50, 46, 24, 20)
const hamsterFace = ellipsePath(50, 48, 31, 24)

export default {
  dog: {
    under: tail(`<path d="M72 80C86 78 88 64 81 56" fill="none" stroke="${V.tail}" stroke-width="8" stroke-linecap="round"/>`, 70, 82)
      + body(50, 77, 23, 20, belly(50, 82, 13, 13)) + paws(94, 12, 8, 4.8),
    head: ear('l', 32, 30, `<ellipse cx="26.5" cy="44" rx="9.5" ry="18" transform="rotate(12 26.5 44)" fill="${V.ear}"/>`)
      + ear('r', 68, 30, `<ellipse cx="73.5" cy="44" rx="9.5" ry="18" transform="rotate(-12 73.5 44)" fill="${V.ear}"/>`)
      + `<path d="${dogFace}" fill="${V.face}"/>` + el(50, 53, 14, 10.5, V.sec),
    front: eyes(38, 10.5, 3.1) + noseDot(48, 5.4, 3.8) + `<path d="M50 52v3.5M50 55.5q-4 4-8 1M50 55.5q4 4 8 1" fill="none" stroke="#4a3030" stroke-width="1.5" stroke-linecap="round"/>`
      + `<path class="pet-tongue" d="M47 58.5h6v3.2a3 3 0 0 1-6 0z" fill="#f4768f"/>` + blush(50, 22),
    face: { d: dogFace, box: [25, 20, 50, 44] },
    anchors: { top: [50, 19], head: [50, 40], neck: [50, 64], w: 50 },
  },

  bunny: {
    under: tail(el(74, 84, 7, 7, V.tail), 74, 84) + body(50, 78, 22, 19, belly(50, 82, 12, 12)) + paws(94, 11, 7.5, 4.4),
    head: ear('l', 40, 32, `<ellipse cx="38" cy="19" rx="7" ry="20" transform="rotate(-8 38 19)" fill="${V.ear}"/><ellipse cx="38" cy="20" rx="3.6" ry="14" transform="rotate(-8 38 20)" fill="${V.inner}"/>`)
      + ear('r', 60, 32, `<ellipse cx="62" cy="19" rx="7" ry="20" transform="rotate(8 62 19)" fill="${V.ear}"/><ellipse cx="62" cy="20" rx="3.6" ry="14" transform="rotate(8 62 20)" fill="${V.inner}"/>`)
      + `<path d="${bunnyFace}" fill="${V.face}"/>`,
    front: eyes(44, 10, 2.8) + noseTri(51, 2.8) + `<path d="M50 53.5v2M50 55.5q-3.5 3-7 .5M50 55.5q3.5 3 7 .5" fill="none" stroke="#6b4a4a" stroke-width="1.3" stroke-linecap="round"/>`
      + `<rect x="47.4" y="56" width="2.5" height="4.2" rx="1" fill="#fff" stroke="#d9d2c6" stroke-width=".5"/><rect x="50.1" y="56" width="2.5" height="4.2" rx="1" fill="#fff" stroke="#d9d2c6" stroke-width=".5"/>`
      + whiskers(52, 34, 20, 2) + blush(54, 16),
    face: { d: bunnyFace, box: [28, 26, 44, 40] },
    anchors: { top: [50, 28], head: [50, 46], neck: [50, 66], w: 44 },
  },

  mouse: {
    under: tail(`<path d="M70 88C92 90 96 70 90 62C86 56 80 60 84 66" fill="none" stroke="${V.tail}" stroke-width="3.2" stroke-linecap="round"/>`, 70, 88)
      + body(50, 77, 21, 19, belly(50, 81, 12, 13)) + paws(94, 11, 6.5, 4, V.paw),
    head: ear('l', 32, 34, `<circle cx="29" cy="30" r="13" fill="${V.ear}"/><circle cx="29" cy="30" r="8" fill="${V.inner}"/>`)
      + ear('r', 68, 34, `<circle cx="71" cy="30" r="13" fill="${V.ear}"/><circle cx="71" cy="30" r="8" fill="${V.inner}"/>`)
      + `<path d="${mouseFace}" fill="${V.face}"/>` + el(50, 54, 10, 8, V.sec),
    front: eyes(43, 10, 2.8) + el(50, 54.5, 3.4, 2.7, V.nose) + `<path d="M50 57v2.2M50 59.2q-3 2.5-6 .2M50 59.2q3 2.5 6 .2" fill="none" stroke="#6b4a4a" stroke-width="1.2" stroke-linecap="round"/>`
      + whiskers(55, 40, 20, 3) + blush(52, 18),
    face: { d: mouseFace, box: [26, 26, 48, 40] },
    anchors: { top: [50, 28], head: [50, 44], neck: [50, 66], w: 48 },
  },

  hamster: {
    under: body(50, 77, 29, 21, belly(50, 82, 17, 14)) + paws(94, 14, 7, 4.2),
    head: ear('l', 30, 32, `<circle cx="28" cy="30" r="8" fill="${V.ear}"/><circle cx="28" cy="30" r="4.6" fill="${V.inner}"/>`)
      + ear('r', 70, 32, `<circle cx="72" cy="30" r="8" fill="${V.ear}"/><circle cx="72" cy="30" r="4.6" fill="${V.inner}"/>`)
      + `<path d="${hamsterFace}" fill="${V.face}"/>` + el(50, 52, 17, 13, V.sec) + `<path d="M50 24c-3 4-2 8 0 11c2-3 3-7 0-11z" fill="${V.sec}" opacity=".7"/>`,
    front: eyes(43, 12, 3) + noseTri(49, 2.4) + `<path d="M50 51.5v1.8M50 53.3q-3 2.6-6 .3M50 53.3q3 2.6 6 .3" fill="none" stroke="#6b4a4a" stroke-width="1.2" stroke-linecap="round"/>`
      + `<rect x="48" y="54" width="4" height="3.6" rx="1.2" fill="#fff"/>` + blush(52, 21),
    face: { d: hamsterFace, box: [19, 24, 62, 48] },
    anchors: { top: [50, 26], head: [50, 48], neck: [50, 68], w: 60 },
  },
}
