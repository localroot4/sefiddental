# Footer game: throw your tooth to the crow

Owner decision, 2026-11-07. The footer playground becomes a short, charming scene from the
Persian folk saying «دندونتو بنداز برای کلاغ، کلاغه برات دندون نو میاره» (throw your tooth to
the crow and it brings you a new one). The crow is film-quality pre-rendered video (owner's
choice, 2026-11-07); the teeth stay live and playable.

## 0. Layout: one footer, not a stage above it

Owner, 2026-11-07: the playground must not be an empty band above the footer; it is the
footer's own background, blended with the footer menus, so the whole footer reads as one
premium composition.

- The separate stage band goes away. The footer becomes one dark section: the brand block,
  address, phones and hours and the three link columns sit on top; the play field is the
  footer's backdrop behind and around them, and its floor is a soft lit horizon just above the
  copyright line, spanning the full width.
- A subtle depth treatment ties them together: a faint radial glow in the brand teal behind the
  floor, a fine horizon line with a soft reflection under the teeth and the crow, a gentle
  vignette toward the edges. No gradients that read as decoration only; no cards.
- The live parts (the mark, the baby teeth) and the crow move in the free space of the footer:
  the floor strip and the open areas between and below the columns. They never cover a link or
  text (the free-space map from the journey applies here too); a thrown part bounces off a
  column's box instead of passing over it.
- The landing (journey D8) is on this floor. «پخش دوباره» becomes a small, quiet control on the
  floor's edge.
- The quality picker («کیفیت»: خودکار، بدون جلوه، سبک، متوسط، کامل) leaves the stage and moves
  into the bottom bar beside the copyright, as a compact «کیفیت جلوه‌ها» control (a select or a
  small popover), still keyboard and screen-reader accessible.
- Phone (390) and tablet portrait: the columns stack as today; the floor strip sits under them
  above the copyright with enough height for the scene (about 220 px), never pushing links out
  of reach.

## 1. The scene

1. The courier mark lands on the footer field floor (journey D8), as today.
2. The reader taps or clicks the mark (or presses «دندونت رو بنداز», the keyboard path). The mark
   cracks softly and spills four small baby teeth that bounce and scatter on the floor. The teeth
   are live: the reader can drag and throw them (gravity, floor bounce, as the playground does
   today).
3. After about 2 s with no touch (or when the reader throws a tooth high), the teeth roll gently
   together to the pick-up spot, and the crow clip plays: the crow flies in, lands beside them,
   hops once, and picks the teeth up in its beak one by one. Each live tooth disappears on the
   video frame where the beak closes on it (timestamps in the clip manifest).
4. The crow flies off. A beat later it returns carrying a shining white tooth, drops it, and
   leaves. The dropped tooth hands over, on a fixed frame, to the live white porcelain mark,
   which lands on the floor with a small sparkle. A short caption fades in under the field:
   «کلاغه دندون نو آورد.» (copy to approve).
5. «پخش دوباره» replays from step 2.

## 2. Video clips (made by the owner with an AI video tool, keyed and encoded by us)

Four clips, each a locked camera, side view, the floor line at 80 % of the frame height, the
crow lit to match the site (soft key from the top left, cool rim light), on a flat chroma
green background (#00B140, no shadows on it, no motion blur on the edges).

| Clip | Length | Action |
|---|---|---|
| `crow-in` | 2.5 s | Enters flying from the right edge, lands at the centre, folds its wings, one small hop |
| `crow-pick` | 3 s | Pecks the floor four times at the centre, as if picking up four small teeth; looks at the camera once |
| `crow-out` | 1.5 s | Takes off and flies out to the left |
| `crow-return` | 3 s | Flies in from the left with a small white tooth in its beak, hovers at the centre, opens its beak (the tooth falls), flies out to the right |

Technical: 3840x2160 (or 1920x1080), 24 or 30 fps, constant frame rate, H.264 or ProRes master,
no camera move, no zoom, no cuts. We key the green, crop to the crow's area, and encode two
web versions per clip: WebM VP9 with alpha (Chrome, Edge, Firefox, Android) and HEVC with alpha
(Safari, iOS). Budget: the four clips together under 2.5 MB per format at about 1200 px wide;
loaded only when the footer is near and the reader first taps the mark.

### Prompts (English works best with video models)

Common style line, append to each prompt:

> Photorealistic, cinematic, shallow depth of field off, sharp focus on the bird, a sleek black
> hooded crow with glossy blue-black feathers and an expressive, friendly look, soft studio key
> light from the upper left, subtle cool rim light, locked-off static camera, side view, the bird
> fully in frame, plain flat chroma-key green background (#00B140) with no shadows, no other
> objects, no text, 4K.

1. `crow-in`: «A crow flies in from the right edge of the frame, glides down and lands softly in
   the centre on an invisible floor at the lower fifth of the frame, folds its wings neatly, then
   makes one small playful hop.»
2. `crow-pick`: «A crow standing in the centre of the frame bends down and pecks at the floor
   four times, as if carefully picking up four tiny white teeth one by one, then turns its head
   and looks at the camera with a curious, friendly tilt.»
3. `crow-out`: «A crow standing in the centre of the frame spreads its wings and takes off,
   flying out of the frame to the left.»
4. `crow-return`: «A crow flies in from the left edge holding a small shiny white tooth in its
   beak, hovers for a moment in the centre above the floor, opens its beak so the tooth drops
   straight down, then flies out of the frame to the right.»

Make several takes of each and pick the ones where the landing and pick-up spots are closest to
the centre; the manifest records the frames we sync to.

## 3. Until the clips exist

The game ships with a placeholder crow (a simple rendered silhouette with the same timings and
the same manifest), so the interaction, the sync points and the tests are done; swapping in the
real clips changes only the media files and the manifest.

## 4. Rules

- Tier 0, reduced motion and Save-Data: a static illustration of the crow and the white tooth;
  no video is downloaded.
- The video is decorative (`aria-hidden`, muted, `playsinline`, no controls); the keyboard path
  and an `aria-live` caption tell the same story.
- Nothing covers the footer's links or text; the field keeps its height (no layout shift).
- Videos never autoplay before the reader's first tap on the mark, and never loop.
