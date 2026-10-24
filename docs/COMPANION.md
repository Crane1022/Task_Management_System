# Virtual pet and desktop companion

Every employee can pick an animal (or their own picture), colour it, give it a name and an accessory, drag it
anywhere on the screen, and choose how it behaves. Open it from the avatar menu or Sidebar > Account > **My companion**.

## What is stored, and where

| What | Where | Syncs between devices? |
|---|---|---|
| Choices: animal, colours, name, accessory, size, position, behaviour, favourites, recent animals | Firestore `users/{uid}/settings/companion` (private to the person; the existing `settings` rule already covers it, **no rules change**) | **Yes** |
| A quick copy of the same choices | the browser (`localStorage`, key `wb-companion:{uid}`) so the pet appears at once on page load | no (a cache) |
| The uploaded character picture and the face photo | the browser's IndexedDB on **this device** only (`widebed-companion`, keys `{uid}:custom` and `{uid}:face`) | **No** |

Why the pictures stay on the device: Firebase Storage is not available on this project, and pictures are not put in Firestore
(no base64 in documents). Nothing is uploaded anywhere. The consequences, which the page tells the person too:

- A custom picture or face photo does not appear on their other computers or phone. The choice itself syncs, so on another device
  the pet shows the default cat plus a notice with an "upload it again" hint. Their colours, name and size still apply.
- Anyone with access to that browser profile could look at the stored pictures through the developer tools.
- Clearing browser data deletes the pictures (the choices are safe in Firestore).
- Each person's pictures are kept under their own uid, and the in-memory copy is wiped on sign-out, so two people on one
  computer never see each other's pet.

To sync pictures later you need a private place for them (Firebase Storage with owner-only rules, or another service).
Only `src/companions/imageStore.js` and the store's `save` and `loadImage` would change.

## Migration, and what everyone sees at first

No companion preferences existed before, so there is nothing to migrate. The five peeking cats on cards, columns, the login
card and dashboard widgets are unchanged and stay on (a person can switch them off under Behaviour). Everyone starts with the
**orange tabby, 96 px, bottom-right, visible**. If you would rather it were opt-in, change `visible: true` to `false` in
`defaultSettings()` (`src/companions/settings.js`); people can then switch it on in My companion.

The five original cats are in the library as "Original cats". They use the same colours as the peeking ones (both read
`src/companions/catSkins.js`), but are drawn full-size, with the face set lower because the whole head is visible.

## The pet on screen

- Drag it with a mouse or finger. A small movement is a pat. It stays inside the window and is recalculated when the window
  is resized (the position is saved as a share of the window, so it adapts to any screen).
- The position is written when a drag **ends**, and quick repeated drags become one write.
- Hover it for a small toolbar: customise, or hide for now (bring it back in My companion > Behaviour).
- It reacts to the app: it cheers when a card is dropped into a column marked "counts as completed" (or its status is changed
  to one), encourages when a task is created, looks around when the board changes.
- It falls asleep after a minute without clicks or keys, and wakes on the next one.
- Sounds are made with the browser's audio (no sound files), **off by default**, with a volume slider.
- It is `aria-hidden`, never takes keyboard focus, and its layer is click-through everywhere except the pet itself. It sits at
  z-index 25: above the page, below menus (30), the mobile drawer (40) and dialogs (50+).
- Reduced motion: the device setting, the app's "Reduce motion" option, or switching Animations off stops every animation.

## Adding an animal

1. Draw it in the right file in `src/companions/art/` (cats, pets, farm, wild or water; or make a new file and add it to `GROUPS`
   in `compose.js`). An entry has `under` (tail, body, feet), `head` (ears and head shape), `front` (eyes, nose, mouth),
   `face` (`d` = the head outline used to mask a face photo, `box` = its bounding box) and `anchors` (where accessories go).
   Use colour variables only: `var(--c-body)`, `--c-secondary`, `--c-face`, `--c-ear`, `--c-inner`, `--c-eye`, `--c-nose`,
   `--c-paw`, `--c-tail`, `--c-marking` (helpers in `art/parts.js`). Give moving parts the classes `pet-eyes`, `pet-tail`,
   `pet-ear pet-ear-l/-r`, `pet-body`, `pet-blush`, with an inline `transform-origin`.
2. Add a line to `ANIMALS` in `src/companions/registry.js`: id, name, category, group, art name, default `palette`, the `parts`
   people may recolour, a sound `voice` and a `greeting`.
3. Run `npm test`. It checks that the animal has a drawing, that its drawing differs from every other animal, and that every
   colour part it offers really appears in the drawing.

## Testing

```
npm test      # unit tests: library, settings, resets, per-person isolation, images, positions, drawings, sounds
npm run build
```

Optional tests that mount the real components in a simulated browser (jsdom): dragging, click vs drag, clamping, resize,
reduced motion, sleep, reactions, hide, the whole customisation page, uploads, reload and sign-in as someone else.
They are not part of `npm test` because they need three extra dev tools:

```
npm i -D vitest@2 jsdom @vue/test-utils
npx vitest run --config test/dom/vitest.config.js
```

### Still needs a person with a real browser

jsdom has no layout, real pointer capture, touch, audio or animation, so please check these by hand:

1. **Kanban drag and drop**: drag a card, then a column, with the pet near them and with the pet dragged over the board.
   Neither should be disturbed; a click on a card right after dragging the pet should open the card, not the pet.
2. **Touch**: on a tablet or phone, drag the pet with a finger without the page scrolling; tap to pat.
3. **Look**: each animal's idle animation (blink, breathing, tail and ear movement), the happy and sleepy faces, a face photo in
   a few animals, and the accessories; light, dark and a custom theme.
4. **Sound**: switch sounds on in Behaviour, press Play, pat the pet; check the volume.
5. **Windows**: resize the browser smaller and larger; the pet should never be lost off-screen.
6. **Two devices**: choose an animal on one and sign in on the other (it follows); upload a picture on one (it does not).
7. **Reduced motion**: turn on your system's reduce-motion setting; nothing should move.

## Limits

- Pictures do not sync between devices (see above).
- Face photos work on the 24 built-in animals only, not on an uploaded character.
- The custom character is a still picture: it breathes, wiggles and sleeps, but has no blinking or tail.
- One pet per person; the position is shared between a person's devices as a share of the window.
