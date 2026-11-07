/**
 * The D5 occlusal arch photo (docs/experience/journey.md section 9): the upper dental arch seen
 * from straight below, incisors at the top, a 4:5 portrait (the owner's photo, credited in
 * public/demo-photos/CREDITS.md). The journey's 3D arch stands its teeth where the photo's teeth
 * are and cross-fades into it registered, so the numbers here are measured on the photo, as shares
 * of its width (u) and height (v). Swapping in another photo replaces only the files
 * (`public/demo-photos/arch-occlusal-{640,1120}.{avif,webp}`) and these numbers. No imports.
 */
export const ARCH_PHOTO = {
  /** Pixel size of the largest file. */
  width: 1120,
  height: 1400,
  /** The arch's middle: on the centre line, halfway between the incisors and the last molars. */
  centre: { u: 0.5, v: 0.538 },
  /** Distance between the two last molars' centres, as a share of the photo's width. */
  archWidth: 0.804,
  /**
   * The screen-right side's teeth, front to back (central incisor to third molar): crown centre,
   * mesio-distal width (share of the photo's width) and bucco-lingual depth against a molar of
   * that width. The other side mirrors them.
   */
  teeth: [
    { u: 0.568, v: 0.227, width: 0.134, depth: 0.85 },
    { u: 0.682, v: 0.255, width: 0.111, depth: 0.8 },
    { u: 0.76, v: 0.314, width: 0.12, depth: 0.95 },
    { u: 0.802, v: 0.403, width: 0.116, depth: 1.35 },
    { u: 0.838, v: 0.492, width: 0.111, depth: 1.4 },
    { u: 0.863, v: 0.606, width: 0.169, depth: 1.1 },
    { u: 0.889, v: 0.729, width: 0.156, depth: 1.2 },
    { u: 0.902, v: 0.849, width: 0.16, depth: 1.15 },
  ],
  /** Index in `teeth` of the first molar, the courier's slot. */
  firstMolar: 5,
  /** False: the file is the clinic's photo, not a stand-in. */
  placeholder: false,
} as const;

/** The widths the files come in (px). */
export const ARCH_PHOTO_WIDTHS = [640, 1120] as const;
