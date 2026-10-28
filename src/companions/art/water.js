import { V, el, ellipsePath, eyes, blush, smile, paws, body, belly, tail, ear, whiskers, noseDot } from './parts.js'

const duckFace = ellipsePath(50, 42, 22, 21)
const otterFace = ellipsePath(50, 43, 24, 20)
const penguinFace = ellipsePath(50, 38, 22, 19)
const frogFace = ellipsePath(50, 51, 30, 19)
const turtleFace = ellipsePath(50, 47, 17, 15)

export default {
  duck: {
    under: tail(`<path d="M72 78Q92 70 90 56Q82 66 70 68z" fill="${V.tail}"/>`, 72, 78)
      + body(50, 77, 27, 20, el(61, 79, 14, 10, V.sec)) + `<ellipse cx="38" cy="96" rx="9.5" ry="3.4" fill="${V.paw}"/><ellipse cx="62" cy="96" rx="9.5" ry="3.4" fill="${V.paw}"/>`,
    head: `<path d="M47 22Q50 12 56 16Q52 18 53 23z" fill="${V.face}"/><path d="${duckFace}" fill="${V.face}"/>`,
    front: eyes(38, 12, 2.9) + `<ellipse cx="50" cy="52" rx="13" ry="6.6" fill="${V.nose}"/><path d="M38 52h24" stroke="#c97a14" stroke-width="1.1" opacity=".55"/><circle cx="46.5" cy="50.6" r="1" fill="#c97a14"/><circle cx="53.5" cy="50.6" r="1" fill="#c97a14"/>` + blush(48, 20),
    face: { d: duckFace, box: [28, 21, 44, 42] },
    anchors: { top: [50, 14], head: [50, 42], neck: [50, 64], w: 44 },
  },

  otter: {
    under: tail(`<path d="M68 92C90 95 98 84 93 76" fill="none" stroke="${V.tail}" stroke-width="10" stroke-linecap="round"/>`, 70, 92)
      + body(50, 78, 22, 21, el(50, 83, 13, 15, V.sec)) + el(41, 78, 6, 5, V.paw) + el(59, 78, 6, 5, V.paw) + paws(95, 9, 8, 4),
    head: ear('l', 32, 28, `<circle cx="31" cy="27" r="5.4" fill="${V.ear}"/>`) + ear('r', 68, 28, `<circle cx="69" cy="27" r="5.4" fill="${V.ear}"/>`)
      + `<path d="${otterFace}" fill="${V.face}"/>` + el(50, 53, 16, 10.5, V.sec),
    front: eyes(40, 11, 2.8) + noseDot(48, 4.6, 3.2) + `<path d="M50 51.5v2.5M50 54q-3.4 3-6.8.4M50 54q3.4 3 6.8.4" fill="none" stroke="#4a3030" stroke-width="1.3" stroke-linecap="round"/>`
      + whiskers(54, 36, 20, 2) + `<g fill="#6b4a30" opacity=".6"><circle cx="43" cy="56" r=".9"/><circle cx="57" cy="56" r=".9"/><circle cx="46" cy="58" r=".9"/><circle cx="54" cy="58" r=".9"/></g>` + blush(50, 20),
    face: { d: otterFace, box: [26, 23, 48, 40] },
    anchors: { top: [50, 22], head: [50, 42], neck: [50, 64], w: 48 },
  },

  penguin: {
    under: body(50, 68, 26, 31, el(50, 74, 17, 23, V.sec)) + `<g class="pet-flippers">${el(23, 68, 6, 17, V.body, 'transform="rotate(16 23 68)"')}${el(77, 68, 6, 17, V.body, 'transform="rotate(-16 77 68)"')}</g>`
      + `<ellipse cx="38" cy="97" rx="9" ry="3.4" fill="${V.paw}"/><ellipse cx="62" cy="97" rx="9" ry="3.4" fill="${V.paw}"/>`,
    head: `<path d="${penguinFace}" fill="${V.face}"/>` + el(50, 43, 15, 12.5, V.sec),
    front: `<g class="pet-eyes" style="transform-origin:50px 37px">${el(39.5, 37, 3.6, 4.2, V.eye)}${el(60.5, 37, 3.6, 4.2, V.eye)}${el(40, 37.4, 1.8, 2.3, '#2b2b2b')}${el(60, 37.4, 1.8, 2.3, '#2b2b2b')}</g>`
      + `<path d="M44 45h12l-6 8z" fill="${V.nose}"/>` + blush(46, 20),
    face: { d: penguinFace, box: [28, 19, 44, 38] },
    anchors: { top: [50, 18], head: [50, 38], neck: [50, 57], w: 44 },
  },

  frog: {
    under: body(50, 78, 27, 19, belly(50, 83, 16, 13)) + `<ellipse cx="24" cy="87" rx="11" ry="7" fill="${V.paw}"/><ellipse cx="76" cy="87" rx="11" ry="7" fill="${V.paw}"/>` + paws(95, 14, 9, 4),
    head: `<path d="${frogFace}" fill="${V.face}"/><g class="pet-bulges"><circle cx="34" cy="34" r="11" fill="${V.face}"/><circle cx="66" cy="34" r="11" fill="${V.face}"/></g>`,
    front: `<g class="pet-eyes" style="transform-origin:50px 34px"><circle cx="34" cy="34" r="8" fill="#fff"/><circle cx="66" cy="34" r="8" fill="#fff"/>${el(35, 35, 4.2, 5, V.eye)}${el(65, 35, 4.2, 5, V.eye)}<circle cx="36.3" cy="33" r="1.3" fill="#fff"/><circle cx="66.3" cy="33" r="1.3" fill="#fff"/></g>`
      + `<path class="pet-mouth" d="M30 57Q50 72 70 57" fill="none" stroke="#2f5d28" stroke-width="2" stroke-linecap="round"/><circle cx="45.5" cy="50" r="1.3" fill="${V.nose}"/><circle cx="54.5" cy="50" r="1.3" fill="${V.nose}"/>` + blush(58, 24),
    face: { d: frogFace, box: [20, 32, 60, 38] },
    anchors: { top: [50, 24], head: [50, 48], neck: [50, 68], w: 60 },
  },

  turtle: {
    under: tail(`<path d="M20 90L8 94L20 96z" fill="${V.tail}"/>`, 20, 92)
      + `<g class="pet-body" style="transform-origin:50px 96px"><path d="M14 90C12 48 88 48 86 90z" fill="${V.body}"/>`
      + `<path d="M24 90L30 66L50 60L70 66L76 90M50 60V90M30 66L50 78L70 66" fill="none" stroke="${V.sec}" stroke-width="2.6" stroke-linejoin="round" opacity=".75"/><path d="M12 90h76v5a38 6 0 0 1-76 0z" fill="${V.sec}"/></g>`
      + `<ellipse cx="26" cy="96" rx="9" ry="5.5" fill="${V.paw}"/><ellipse cx="74" cy="96" rx="9" ry="5.5" fill="${V.paw}"/>`,
    head: el(50, 66, 9, 12, V.face) + `<path d="${turtleFace}" fill="${V.face}"/>`,
    front: eyes(45, 8, 2.5) + `<path class="pet-mouth" d="M43 53Q50 59 57 53" fill="none" stroke="#3f5f2a" stroke-width="1.5" stroke-linecap="round"/><circle cx="48" cy="49.5" r=".9" fill="${V.nose}"/><circle cx="52" cy="49.5" r=".9" fill="${V.nose}"/>` + blush(51, 12),
    face: { d: turtleFace, box: [33, 32, 34, 30] },
    anchors: { top: [50, 30], head: [50, 46], neck: [50, 62], w: 34 },
  },
}
