/** The attributes and the event the journey shares with the DOM scenes (no code, no imports). */

/** Phase 8's stage attribute: the booking and footer stages are transparent under it. */
export const STAGE_ATTR = 'data-world-stage';
/** On the footer's mark part while the courier has not landed on it (the hand-off). */
export const AWAY_ATTR = 'data-courier-away';
/**
 * On a logo mark for a moment as the courier lands in it (the header's, the footer part): a soft
 * outline echo spreads from it once (globals.css).
 */
export const LANDED_ATTR = 'data-courier-landed';
/**
 * On a section heading while it waits for its rise (scenes/dom/reveal.ts revealHeading): it is
 * drawn lower than it rests, so the journey measures its text and the docks in it at rest.
 */
export const RISE_ATTR = 'data-rise';
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
/**
 * The courier's layers while the courier is in the header band (lifting out of the header logo or
 * coming home into it): above the header (z 30), so the mark leaves the logo in front of the bar.
 */
export const HEADER_Z = '31';
/** On `html`: the courier draws nothing (a check of the page's own pixels; globals.css). */
export const COURIER_OFF_ATTR = 'data-courier-off';
