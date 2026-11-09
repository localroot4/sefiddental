/** The attributes and the event the journey shares with the DOM scenes (no code, no imports). */

/** Phase 8's stage attribute: the booking and footer stages are transparent under it. */
export const STAGE_ATTR = 'data-world-stage';
/** On the footer's mark part while the courier has not landed on it (the hand-off). */
export const AWAY_ATTR = 'data-courier-away';
/** Dispatched on the mark part when the courier lifts off it again (footer.ts sends it home). */
export const LIFTOFF_EVENT = 'sefid:courier-liftoff';
/** On the services mark while the courier stands in for it (D2 is the mark's own box). */
export const HERE_ATTR = 'data-courier-here';
/**
 * The courier's layers (the canvas and the DOM courier) in `.site`'s stacking context: above the
 * sections' own boxes, below the hero's cards (`[data-above-courier]`, z 2), the header and the
 * sticky bar. The courier's lanes keep it off every text and control (route.ts).
 */
export const COURIER_Z = '1';
/** The courier's layers while the intro hand-off leads: above the hero's cards, under the header. */
export const LEAD_Z = '3';
/** On `html`: the courier draws nothing (a check of the page's own pixels; globals.css). */
export const COURIER_OFF_ATTR = 'data-courier-off';
