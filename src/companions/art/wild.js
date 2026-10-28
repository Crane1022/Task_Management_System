import { V, el, ellipsePath, eyes, blush, smile, paws, body, belly, tail, ear, noseTri, noseDot, whiskers } from './parts.js'

const foxFace = ellipsePath(50, 44, 24, 19)
const redFace = ellipsePath(50, 44, 25, 20)
const racFace = ellipsePath(50, 44, 25, 20)
const koalaFace = ellipsePath(50, 44, 24, 21)
const bearFace = ellipsePath(50, 44, 25, 22)
const pandaFace = ellipsePath(50, 44, 25, 22)
const capyFace = 'M40 30H60A16 16 0 0 1 76 46V48A16 16 0 0 1 60 64H40A16 16 0 0 1 24 48V46A16 16 0 0 1 40 30Z'

const stripedTail = (rot, fill, stripes, ox, oy) => tail(`<g transform="rotate(${rot} 84 74)"><ellipse cx="84" cy="74" rx="9" ry="22" fill="${fill}"/><g fill="none" stroke="${stripes}" stroke-width="3.2" stroke-linecap="round" opacity=".85"><path d="M76 62h16M75 70h18M76 78h16M78 86h12"/></g></g>`, ox, oy)

export default {
  fox: {
    under: tail(`<ellipse cx="83" cy="72" rx="9.5" ry="23" transform="rotate(28 83 72)" fill="${V.tail}"/><ellipse cx="92" cy="55" rx="6" ry="8" transform="rotate(28 92 55)" fill="${V.sec}"/>`, 72, 84)
      + body(50, 78, 22, 19, belly(50, 83, 11, 13)) + paws(95, 11, 7.5, 4.4),
    head: ear('l', 36, 36, `<polygon points="27,40 29,6 48,28" fill="${V.ear}"/><polygon points="31,32 31,14 41,27" fill="${V.inner}"/>`)
      + ear('r', 64, 36, `<polygon points="73,40 71,6 52,28" fill="${V.ear}"/><polygon points="69,32 69,14 59,27" fill="${V.inner}"/>`)
      + `<path d="${foxFace}" fill="${V.face}"/>` + el(35, 52, 14, 9, V.sec, 'transform="rotate(-16 35 52)"') + el(65, 52, 14, 9, V.sec, 'transform="rotate(16 65 52)"') + el(50, 53, 9, 7, V.sec),
    front: eyes(40, 11, 2.8) + el(50, 49.5, 4, 3, V.nose) + `<path d="M50 52.5v2.2M50 54.7q-3 2.4-6 .3M50 54.7q3 2.4 6 .3" fill="none" stroke="#4a3030" stroke-width="1.2" stroke-linecap="round"/>` + blush(51, 22),
    face: { d: foxFace, box: [26, 25, 48, 38] },
    anchors: { top: [50, 14], head: [50, 42], neck: [50, 64], w: 48 },
  },

  redpanda: {
    under: stripedTail(28, V.tail, V.mark, 72, 84) + body(50, 78, 22, 19, el(50, 83, 13, 13, V.mark, 'opacity=".9"')) + paws(95, 11, 7.5, 4.4),
    head: ear('l', 33, 34, `<circle cx="30" cy="29" r="10" fill="${V.ear}"/><circle cx="30.5" cy="30" r="6" fill="${V.inner}"/>`)
      + ear('r', 67, 34, `<circle cx="70" cy="29" r="10" fill="${V.ear}"/><circle cx="69.5" cy="30" r="6" fill="${V.inner}"/>`)
      + `<path d="${redFace}" fill="${V.face}"/>` + el(33, 51, 12, 9, V.sec) + el(67, 51, 12, 9, V.sec) + el(50, 54, 8.5, 6.5, V.sec)
      + `<g fill="none" stroke="${V.mark}" stroke-width="2.6" stroke-linecap="round"><path d="M41 44Q38 51 36 55"/><path d="M59 44Q62 51 64 55"/></g>`,
    front: eyes(41, 10.5, 2.7) + el(50, 50.5, 4, 3, V.nose) + `<path d="M50 53.5v2M50 55.5q-3 2.4-6 .3M50 55.5q3 2.4 6 .3" fill="none" stroke="#3a2a2a" stroke-width="1.2" stroke-linecap="round"/>` + blush(52, 21),
    face: { d: redFace, box: [25, 24, 50, 40] },
    anchors: { top: [50, 19], head: [50, 42], neck: [50, 64], w: 50 },
  },

  raccoon: {
    under: stripedTail(28, V.tail, V.mark, 72, 84) + body(50, 78, 22, 19, belly(50, 83, 12, 13)) + paws(95, 11, 7.5, 4.4),
    head: ear('l', 33, 34, `<circle cx="31" cy="29" r="9" fill="${V.ear}"/><circle cx="31.5" cy="30" r="4.6" fill="${V.inner}"/>`)
      + ear('r', 67, 34, `<circle cx="69" cy="29" r="9" fill="${V.ear}"/><circle cx="68.5" cy="30" r="4.6" fill="${V.inner}"/>`)
      + `<path d="${racFace}" fill="${V.face}"/>` + el(50, 54, 11, 8, V.sec)
      + `<path d="M26 41Q50 29 74 41L70 51Q50 43 30 51Z" fill="${V.mark}"/>` + `<path d="M46 27Q50 33 54 27" fill="none" stroke="#f4f4f4" stroke-width="3" stroke-linecap="round" opacity=".9"/>`,
    front: `<g class="pet-eyes" style="transform-origin:50px 42px">${el(39, 42, 4, 3.6, V.eye)}${el(61, 42, 4, 3.6, V.eye)}${el(39.4, 42.2, 1.9, 2.1, '#2b2b2b')}${el(60.6, 42.2, 1.9, 2.1, '#2b2b2b')}</g>`
      + el(50, 51, 4, 3, V.nose) + `<path d="M50 54v2M50 56q-3 2.4-6 .3M50 56q3 2.4 6 .3" fill="none" stroke="#3a3a40" stroke-width="1.2" stroke-linecap="round"/>` + blush(54, 22),
    face: { d: racFace, box: [25, 24, 50, 40] },
    anchors: { top: [50, 19], head: [50, 42], neck: [50, 64], w: 50 },
  },

  koala: {
    under: body(50, 78, 23, 19, belly(50, 82, 14, 14)) + el(36, 86, 7, 9, V.paw, 'transform="rotate(14 36 86)"') + el(64, 86, 7, 9, V.paw, 'transform="rotate(-14 64 86)"') + paws(95, 12, 8, 4.4),
    head: ear('l', 32, 36, `<circle cx="26" cy="32" r="15" fill="${V.ear}"/><circle cx="26" cy="32" r="9" fill="${V.inner}"/>`)
      + ear('r', 68, 36, `<circle cx="74" cy="32" r="15" fill="${V.ear}"/><circle cx="74" cy="32" r="9" fill="${V.inner}"/>`)
      + `<path d="${koalaFace}" fill="${V.face}"/>`,
    front: eyes(40, 13, 2.5) + `<ellipse cx="50" cy="49" rx="7.6" ry="10" fill="${V.nose}"/><ellipse cx="48" cy="45" rx="2" ry="1.3" fill="#fff" opacity=".35"/><path d="M50 59v2.5M50 61.5q-3.5 3-7 .2M50 61.5q3.5 3 7 .2" fill="none" stroke="#4a4a50" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>` + blush(51, 22),
    face: { d: koalaFace, box: [26, 23, 48, 42] },
    anchors: { top: [50, 22], head: [50, 44], neck: [50, 65], w: 48 },
  },

  bear: {
    under: tail(el(74, 87, 5, 5, V.tail), 74, 87) + body(50, 78, 25, 20, belly(50, 83, 14, 13)) + paws(95, 13, 8.5, 4.8),
    head: ear('l', 32, 34, `<circle cx="29" cy="27" r="10" fill="${V.ear}"/><circle cx="29" cy="27.5" r="5.6" fill="${V.inner}"/>`)
      + ear('r', 68, 34, `<circle cx="71" cy="27" r="10" fill="${V.ear}"/><circle cx="71" cy="27.5" r="5.6" fill="${V.inner}"/>`)
      + `<path d="${bearFace}" fill="${V.face}"/>` + el(50, 54, 12.5, 9.5, V.sec),
    front: eyes(40, 12, 2.9) + noseDot(50, 5.2, 3.6) + `<path d="M50 53.6v3M50 56.6q-3.6 3.2-7.2.6M50 56.6q3.6 3.2 7.2.6" fill="none" stroke="#3a2a22" stroke-width="1.4" stroke-linecap="round"/>` + blush(52, 23),
    face: { d: bearFace, box: [25, 22, 50, 44] },
    anchors: { top: [50, 20], head: [50, 44], neck: [50, 66], w: 50 },
  },

  panda: {
    under: tail(el(74, 88, 5.5, 5, V.body), 74, 88) + body(50, 78, 25, 20, '') + belly(50, 82, 16, 14)
      + el(26, 76, 8, 15, V.mark, 'transform="rotate(14 26 76)"') + el(74, 76, 8, 15, V.mark, 'transform="rotate(-14 74 76)"') + paws(95, 14, 9.5, 5, V.paw),
    head: ear('l', 32, 34, `<circle cx="30" cy="27" r="10" fill="${V.ear}"/>`) + ear('r', 68, 34, `<circle cx="70" cy="27" r="10" fill="${V.ear}"/>`)
      + `<path d="${pandaFace}" fill="${V.face}"/>` + el(37, 41, 7.2, 9.4, V.mark, 'transform="rotate(-22 37 41)"') + el(63, 41, 7.2, 9.4, V.mark, 'transform="rotate(22 63 41)"'),
    front: `<g class="pet-eyes" style="transform-origin:50px 41px">${el(38, 41, 3, 3.6, V.eye)}${el(62, 41, 3, 3.6, V.eye)}${el(38.4, 41.4, 1.5, 1.9, '#2b2b2b')}${el(61.6, 41.4, 1.5, 1.9, '#2b2b2b')}</g>`
      + el(50, 51, 4.6, 3.2, V.nose) + `<path d="M50 54v2.5M50 56.5q-3.4 3-6.8.4M50 56.5q3.4 3 6.8.4" fill="none" stroke="#2b2b2b" stroke-width="1.3" stroke-linecap="round"/>` + blush(53, 24),
    face: { d: pandaFace, box: [25, 22, 50, 44] },
    anchors: { top: [50, 20], head: [50, 44], neck: [50, 66], w: 50 },
  },

  capybara: {
    under: body(50, 81, 30, 17, el(50, 87, 20, 9, V.sec)) + paws(95, 17, 9.5, 4.6),
    head: ear('l', 33, 32, `<circle cx="32" cy="30" r="5.4" fill="${V.ear}"/><circle cx="32" cy="30.4" r="2.8" fill="${V.inner}"/>`)
      + ear('r', 67, 32, `<circle cx="68" cy="30" r="5.4" fill="${V.ear}"/><circle cx="68" cy="30.4" r="2.8" fill="${V.inner}"/>`)
      + `<path d="${capyFace}" fill="${V.face}"/>` + `<rect x="31" y="51" width="38" height="13" rx="6.5" fill="${V.sec}"/>`,
    front: eyes(40, 14, 2.4) + `<rect x="40" y="50" width="20" height="9.5" rx="4.7" fill="${V.nose}"/><circle cx="45.5" cy="54" r="1.1" fill="#12100e"/><circle cx="54.5" cy="54" r="1.1" fill="#12100e"/><path d="M44 62q6 2.6 12 0" fill="none" stroke="#4a3322" stroke-width="1.3" stroke-linecap="round"/>` + blush(52, 24),
    face: { d: capyFace, box: [24, 30, 52, 34] },
    anchors: { top: [50, 26], head: [50, 46], neck: [50, 66], w: 52 },
  },
}
